"""Departure ownership checks at actual API routes, without production writes."""
import copy
import sys
import tempfile
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import permissions
from legacy_api import create_app

class DepartureAccessTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.policy = permissions.default_policy()
        self.policy['roles']['工程人員'] = copy.deepcopy(self.policy['roles']['borrower'])
        self.policy['user_roles'] = {'engineer-id': ['工程人員'], 'admin-id': ['admin']}
        self.user = {'id': 'engineer-id', 'name': '工程師', 'email': 'test@test'}
        self.user['permissions'] = permissions.effective_policy(self.policy, self.user)
        engine = MagicMock(); engine.dialect.name = 'postgresql'
        with patch('legacy_api.create_engine', return_value=engine):
            self.app = create_app(root, root / 'data', 'postgresql://unused')
        self.app.state.sso.current = lambda request: self.user
        self.repo = MagicMock()
        self.booking = {'id': '11510A0001', 'kind': 'A', 'owner': 'other-id', 'status': 'PENDING', 'content': {'applicant': '別人'}}
        self.repo.booking.side_effect = lambda *args: self.booking
        self.repo.advance.return_value = {'ok': True}
        # submitted_by is the engineer, but the ORIGINAL booking belongs to someone else.
        self.repo.stage.return_value = {'kind': 'B', 'parent_id': '11510A0001', 'owner': 'engineer-id', 'content': {}, 'applicant_owner': 'other-id'}
        self.repo.edit_stage.return_value = {'ok': True}
        self.app.state.store = MagicMock()
        self.app.state.store.session.side_effect = lambda *args: nullcontext(self.repo)
        self.client = TestClient(self.app)
    def tearDown(self):
        self.client.close(); self.temp.cleanup()
    def advance(self):
        return self.client.post('/api/bookings/11510A0001/advance', json={'expected_status': self.booking['status'], 'revision': 1, 'content': {}}, headers={'x-ams-client': 'preview'})
    def test_engineer_cannot_create_or_arrive_for_others(self):
        for status in ['PENDING', 'DEPARTURE']:
            self.booking['status'] = status
            response = self.advance()
            self.assertEqual(response.status_code, 403, response.text)
        self.repo.advance.assert_not_called()
    def test_engineer_can_fill_own_booking(self):
        self.booking['owner'] = 'engineer-id'
        for status in ['PENDING', 'DEPARTURE']:
            self.booking['status'] = status
            self.assertEqual(self.advance().status_code, 200)
    def test_edit_uses_original_applicant_not_last_submitter(self):
        response = self.client.put('/api/stages/11510B0001', json={'revision': 1, 'content': {}}, headers={'x-ams-client': 'preview'})
        self.assertEqual(response.status_code, 403, response.text)
        self.repo.edit_stage.assert_not_called()
    def test_admin_can_create_and_edit_for_others(self):
        self.user = {'id': 'admin-id', 'name': '管理員'}
        self.user['permissions'] = permissions.effective_policy(self.policy, self.user)
        self.assertEqual(self.advance().status_code, 200)
        response = self.client.put('/api/stages/11510B0001', json={'revision': 1, 'content': {}}, headers={'x-ams-client': 'preview'})
        self.assertEqual(response.status_code, 200, response.text)
    def test_email_case_and_forged_applicant(self):
        self.booking['owner'] = 'TEST@TEST'
        self.assertEqual(self.advance().status_code, 200)
        self.booking['owner'] = 'other-id'
        self.booking['content']['applicant'] = self.user['name']
        self.assertEqual(self.advance().status_code, 403)
        self.booking['owner'] = ''
        self.booking['content']['applicant'] = ''
        self.assertEqual(self.advance().status_code, 403)

    def test_other_booking_list_is_summary_and_detail_is_denied(self):
        other = {**self.booking, 'slots': [{'resource_id': 1, 'start': '2026-10-07T09:00:00', 'end': '2026-10-07T10:00:00'}],
                 'content': {'applicant': '別人', 'title': 'secret title', 'notes': 'secret notes', 'details': [{'name': 'secret project'}], 'attachments': [{'id': 'secret file'}]},
                 'contact_person': 'secret contact', 'revision': 99}
        own = {**other, 'id': 'own-booking', 'owner': self.user['id']}
        self.repo.bookings.return_value = [other, own]
        response = self.client.get('/api/bookings')
        self.assertEqual(response.status_code, 200, response.text)
        summary, full = response.json()
        self.assertFalse(summary['detail_allowed'])
        self.assertEqual(summary['content'], {'applicant': '別人', 'title': '借用紀錄'})
        self.assertEqual(summary['slots'], other['slots'])
        self.assertNotIn('secret', str(summary))
        self.assertNotIn('contact_person', summary)
        self.assertNotIn('owner', summary)
        self.assertEqual(full['content']['notes'], 'secret notes')
        response = self.client.get('/api/bookings/11510A0001')
        self.assertEqual(response.status_code, 403, response.text)
        self.repo.detail.assert_not_called()
        response = self.client.put('/api/bookings/11510A0001', json={'kind': 'A', 'content': {}, 'revision': 1}, headers={'x-ams-client': 'preview'})
        self.assertEqual(response.status_code, 403, response.text)
        self.repo.save_booking.assert_not_called()

    def test_other_stages_hidden_and_direct_stage_read_denied(self):
        other = {**self.repo.stage.return_value, 'applicant_owner': 'other-id'}
        own = {**other, 'applicant_owner': 'engineer-id'}
        self.repo.stages.return_value = [other, own]
        response = self.client.get('/api/stages?kind=B')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]['applicant_owner'], 'engineer-id')
        response = self.client.get('/api/stages/11510B0001')
        self.assertEqual(response.status_code, 403, response.text)

    def test_admin_and_own_booking_details_remain_available(self):
        self.repo.detail.return_value = self.booking
        self.booking['owner'] = 'engineer-id'
        self.assertEqual(self.client.get('/api/bookings/11510A0001').status_code, 200)
        self.booking['owner'] = 'other-id'
        self.user = {'id': 'admin-id', 'name': '管理員'}
        self.user['permissions'] = permissions.effective_policy(self.policy, self.user)
        self.assertEqual(self.client.get('/api/bookings/11510A0001').status_code, 200)

    def test_no_access_user_can_read_identity_but_no_workspace_data(self):
        self.user={'id':'external-id','email':'external@test','name':'外部人員'}
        self.user['permissions']=permissions.effective_policy({'module':'AMS','version':1,'roles':{},'user_roles':{},'ui':{}},self.user)
        self.assertEqual(self.client.get('/api/auth/me').status_code,200)
        for path in ['/api/bookings','/api/bookings/11510A0001','/api/stages','/api/resources','/api/holidays','/api/files/known-file','/api/permissions','/api/notifications']:
            response=self.client.get(path)
            self.assertEqual(response.status_code,403,(path,response.text))
            self.assertEqual(response.json()['detail'],'沒有權限')
        self.repo.bookings.assert_not_called()
        self.repo.stages.assert_not_called()
        response=self.client.post('/api/notifications/check',headers={'x-ams-client':'preview'})
        self.assertEqual(response.status_code,403,response.text)

if __name__ == '__main__': unittest.main(verbosity=2)
