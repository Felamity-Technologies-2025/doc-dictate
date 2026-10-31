import uuid
import json
import logging
from datetime import datetime
from config import Config
from services.json_store import get_store

logger = logging.getLogger(__name__)

LIST_FIELDS = ('id', 'title', 'text_content', 'word_count', 'template_id', 'created_at', 'updated_at')


class DocumentService:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or Config.DATABASE_PATH
        self.store = get_store(self.db_path)

    @staticmethod
    def _with_content_json(row: dict) -> dict:
        doc = dict(row)
        # Try parsing json content if formatted as json
        try:
            doc['content_json'] = json.loads(doc['content'])
        except Exception:
            doc['content_json'] = None
        return doc

    def get_all_documents(self) -> list:
        with self.store.read() as data:
            docs = [{key: row.get(key) for key in LIST_FIELDS} for row in data['documents']]
        return sorted(docs, key=lambda d: d['updated_at'], reverse=True)

    def get_document(self, doc_id: str) -> dict:
        with self.store.read() as data:
            row = next((d for d in data['documents'] if d['id'] == doc_id), None)
            return self._with_content_json(row) if row else None

    def create_document(self, title: str, content: str, text_content: str = "", word_count: int = 0,
                        template_id: str = None) -> dict:
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + "Z"
        title = title.strip() or "Untitled Document"

        row = {
            'id': doc_id,
            'title': title,
            'content': content,
            'text_content': text_content,
            'word_count': word_count,
            'created_at': now,
            'updated_at': now,
            'template_id': template_id,
        }
        with self.store.transaction() as data:
            data['documents'].append(row)

        return self._with_content_json(row)

    def update_document(self, doc_id: str, title: str = None, content: str = None, text_content: str = None, word_count: int = None) -> dict:
        with self.store.transaction() as data:
            row = next((d for d in data['documents'] if d['id'] == doc_id), None)
            if not row:
                return None

            row['title'] = title.strip() if title is not None else row['title']
            row['content'] = content if content is not None else row['content']
            row['text_content'] = text_content if text_content is not None else row.get('text_content', '')
            row['word_count'] = word_count if word_count is not None else row.get('word_count', 0)
            row['updated_at'] = datetime.utcnow().isoformat() + "Z"
            return self._with_content_json(row)

    def delete_document(self, doc_id: str) -> bool:
        with self.store.transaction() as data:
            before = len(data['documents'])
            data['documents'] = [d for d in data['documents'] if d['id'] != doc_id]
            return len(data['documents']) < before

# Singleton instance
document_service = DocumentService()
