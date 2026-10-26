"""Exercise the legacy repository in disposable SQLite; never read DB credentials."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from sqlalchemy import Column, Integer, MetaData, Table, Text, create_engine, select

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from legacy_store import Store, Repository, ASSETS, RECORDS, EQUIPMENT_FILES


class EquipmentFiles(unittest.TestCase):
    def setup_store(self, original_columns=False):
        directory = tempfile.TemporaryDirectory(prefix='polimax-asset-files-')
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        engine = create_engine('sqlite:///' + str(root / 'isolated.db'))
        self.addCleanup(engine.dispose)
        metadata = MetaData()
        for kind, (name, primary, label, deleted, fields) in ASSETS.items():
            columns = {label, deleted, *fields.values()}
            if kind == 'equipment' and original_columns:
                columns.update(EQUIPMENT_FILES.values())
            Table(name, metadata, Column(primary, Integer, primary_key=True),
                  *(Column(col, Integer, default=0) if col == deleted else Column(col, Text) for col in sorted(columns)))
        for name, fields in RECORDS.values():
            Table(name, metadata, Column('sn', Integer, primary_key=True),
                  *(Column(col, Text) for col in sorted(set(fields.values()))))
        Table('formio_responses', metadata, Column('form_id', Text), Column('place', Text))
        Table('form_flows', metadata, Column('id', Integer, primary_key=True))
        metadata.create_all(engine)
        with patch.dict(os.environ, {}, clear=True):
            store = Store(engine, root, root / 'persistent')
        return root, engine, store

    def save(self, store, body, resource_id=None):
        with store.engine.begin() as connection:
            repo = Repository(store, connection)
            try:
                result = repo.save_resource(body, resource_id)
                repo.install_files()
                return result
            except BaseException:
                repo.restore_files()
                raise

    def body(self):
        return {'kind': 'equipment', 'label': 'EQ-PARITY', 'data': {
            'name': '文件測試儀器', 'location': 'Z-1', 'quantity': 1, 'state': '列管',
            **{key: [{'id': key + '-id', 'name': key + '.pdf', 'mime': 'application/pdf'}]
               for key in EQUIPMENT_FILES},
        }}

    def test_missing_original_columns_persist_and_reopen_without_schema_change(self):
        root, engine, store = self.setup_store()
        before = set(store.tables['EquipmentList'].c.keys())
        body = self.body()
        result = self.save(store, body)
        self.assertEqual(result['source_id'], 1)
        path = store.data / 'equipment-files' / '1.json'
        self.assertTrue(path.exists())
        with patch.dict(os.environ, {}, clear=True):
            reopened = Store(engine, root, store.data)
        with engine.connect() as connection:
            read = Repository(reopened, connection).resource(result['id'])
            for key in EQUIPMENT_FILES:
                self.assertEqual(read[key][0]['name'], key + '.pdf')
        replacement = {**body, 'data': {**body['data'], 'manual_files': []}}
        updated = self.save(reopened, replacement, result['id'])
        self.assertEqual(updated['manual_files'], [])
        self.assertEqual(updated['warranty_files'], body['data']['warranty_files'])
        self.assertEqual(set(reopened.tables['EquipmentList'].c.keys()), before)
        self.assertTrue(list(path.parent.glob('1_*.bak.json')))

    def test_original_file_columns_use_existing_table(self):
        root, engine, store = self.setup_store(original_columns=True)
        body = self.body()
        result = self.save(store, body)
        with engine.connect() as connection:
            row = connection.execute(select(store.tables['EquipmentList'])).mappings().one()
            for key, col in EQUIPMENT_FILES.items():
                self.assertEqual(json.loads(row[col])[0]['uuid'], key + '-id')
                self.assertEqual(Repository(store, connection).resource(result['id'])[key][0]['name'], key + '.pdf')
        self.assertFalse((store.data / 'equipment-files').exists())

    def test_failed_transaction_restores_sidecar_and_table(self):
        root, engine, store = self.setup_store()
        body = self.body()
        result = self.save(store, body)
        path = store.data / 'equipment-files' / '1.json'
        previous = path.read_bytes()
        repo = None
        try:
            with engine.begin() as connection:
                repo = Repository(store, connection)
                repo.save_resource({**body, 'label': 'SHOULD-ROLLBACK', 'data': {**body['data'], 'manual_files': []}}, result['id'])
                repo.install_files()
                raise RuntimeError('simulated commit failure')
        except RuntimeError:
            repo.restore_files()
        self.assertEqual(path.read_bytes(), previous)
        with engine.connect() as connection:
            self.assertEqual(Repository(store, connection).resource(result['id'])['label'], 'EQ-PARITY')


if __name__ == '__main__':
    unittest.main(verbosity=2)
