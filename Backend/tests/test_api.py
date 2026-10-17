import io
import os
import unittest
import tempfile
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app import create_app
from services.document_service import DocumentService

class BackendApiTestCase(unittest.TestCase):
    def setUp(self):
        # Create temporary database for testing
        self.db_fd, self.db_path = tempfile.mkstemp(suffix='.db')
        self.app = create_app()
        self.app.config['DATABASE_PATH'] = self.db_path
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

    def tearDown(self):
        os.close(self.db_fd)
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

    def test_health_check(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('service'), 'audio-transcription')

    def test_document_lifecycle(self):
        # 1. Create document
        create_resp = self.client.post('/api/documents', json={
            'title': 'Test Meeting Minutes',
            'content': '<p>Discussed speech recognition architecture.</p>',
            'text_content': 'Discussed speech recognition architecture.',
            'word_count': 4
        })
        self.assertEqual(create_resp.status_code, 201)
        doc = create_resp.get_json()['document']
        doc_id = doc['id']
        self.assertEqual(doc['title'], 'Test Meeting Minutes')
        self.assertEqual(doc['word_count'], 4)

        # 2. List documents
        list_resp = self.client.get('/api/documents')
        self.assertEqual(list_resp.status_code, 200)
        docs = list_resp.get_json()['documents']
        self.assertTrue(any(d['id'] == doc_id for d in docs))

        # 3. Retrieve document
        get_resp = self.client.get(f'/api/documents/{doc_id}')
        self.assertEqual(get_resp.status_code, 200)
        fetched = get_resp.get_json()['document']
        self.assertEqual(fetched['title'], 'Test Meeting Minutes')

        # 4. Update document
        update_resp = self.client.put(f'/api/documents/{doc_id}', json={
            'title': 'Updated Minutes',
            'word_count': 10
        })
        self.assertEqual(update_resp.status_code, 200)
        updated = update_resp.get_json()['document']
        self.assertEqual(updated['title'], 'Updated Minutes')
        self.assertEqual(updated['word_count'], 10)

        # 5. Delete document
        del_resp = self.client.delete(f'/api/documents/{doc_id}')
        self.assertEqual(del_resp.status_code, 200)

        # 6. Verify deleted
        get_after = self.client.get(f'/api/documents/{doc_id}')
        self.assertEqual(get_after.status_code, 404)

    def test_transcription_missing_file(self):
        response = self.client.post('/api/transcribe')
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertFalse(data.get('success'))
        self.assertIn('No audio file provided', data.get('error', ''))

    def test_transcription_invalid_extension(self):
        data = {
            'audio': (io.BytesIO(b"fake text content"), 'not_an_audio.txt')
        }
        response = self.client.post('/api/transcribe', data=data, content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)
        res = response.get_json()
        self.assertFalse(res.get('success'))
        self.assertIn('Unsupported audio format', res.get('error', ''))

if __name__ == '__main__':
    unittest.main()
