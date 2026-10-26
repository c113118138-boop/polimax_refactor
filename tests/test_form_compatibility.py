"""Legacy field round trips use anonymous fixtures and no database connection."""
import copy
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from legacy_store import Repository, FIELD_MAP

class FormCompatibility(unittest.TestCase):
    def test_old_a_people_purposes_and_recall_name(self):
        for reason in ('工案', '成交案回訪'):
            config=FIELD_MAP['table'][reason]
            leader,sales=('reasonCaseGrid','reasonCaseGrid2') if reason=='工案' else ('reasonRecallGrid','reasonRecallGrid2')
            raw={'Requirement_select':reason,config['grid_key']:[{
                FIELD_MAP['reason_detail_field_map'][reason]:'測試工案',config['city_field']:'新竹市',config['district_field']:'東區',leader:'手填組長',sales:['手填業務']
            }],'Inside_factory':True,'Other_processing':True,'Other_Processing_comment':'測試加工'}
            row={'form_id':'11510A0001','reason':reason,'applicant_ID':'test-owner','employees':'登入者,第二人','created_at':datetime(2026,10,10),'start':datetime(2026,10,11,9),'end':datetime(2026,10,11,10),'plate':'TEST-001','place':'新竹市東區'}
            resource={'id':11,'label':'TEST-001','kind':'vehicle'}
            content=Repository.legacy_content(Mock(),raw,[row],[resource])
            self.assertEqual(content['details'][0]['name'],'測試工案')
            self.assertEqual(content['details'][0]['leader'],'手填組長')
            self.assertEqual(content['details'][0]['sales'],['手填業務'])
            self.assertEqual(content['purposes'],['廠內','其他加工'])
            self.assertEqual(content['other_processing'],'測試加工')
            repo=Mock();repo.resource.return_value=resource
            encoded=Repository.encode_booking(repo,'11510A0001',content,raw)
            self.assertEqual(encoded[config['grid_key']][0][leader],'手填組長')
            self.assertEqual(encoded[config['grid_key']][0][sales],['手填業務'])
            self.assertEqual(encoded['Other_Processing_comment'],'測試加工')
            again=Repository.legacy_content(repo,encoded,[row],[resource])
            self.assertEqual(again['details'],content['details'])
    def test_e_canonical_all_categories_preserved(self):
        for reason in ['開案','成案（施工前量測）','成案（完工量測）','成案（服務回訪）','儀器設備保養／校正','儀器設備維修','其它']:
            content={'title':'E 測試','reason':reason,'applicant':'測試者','application_date':'2026-10-10','employees':['測試者','手填人員'],'details':[{'name':'案件／廠商','city':'新竹市','district':'東區','notes2':'補充'}],'slots':[{'resource_id':12,'start':'2026-10-11T09:00:00+08:00','end':'2026-10-11T10:00:00+08:00','detail_index':0}]}
            row={'form_id':'11510E0001','reason':reason,'applicant_ID':'test-owner','employees':'測試者,手填人員','created_at':datetime(2026,10,10),'start':datetime(2026,10,11,9),'end':datetime(2026,10,11,10),'plate':'EQ-TEST','place':'新竹市東區'}
            raw=Repository.encode_booking(Mock(),'11510E0001',copy.deepcopy(content))
            decoded=Repository.legacy_content(Mock(),raw,[row],[{'id':12,'label':'EQ-TEST','kind':'equipment'}])
            self.assertEqual(decoded['details'],content['details']);self.assertEqual(decoded['reason'],reason)

if __name__=='__main__':unittest.main()
