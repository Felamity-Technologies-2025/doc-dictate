import os
import sqlite3
import uuid
import json
import logging
from datetime import datetime
from config import Config

logger = logging.getLogger(__name__)

class DocumentService:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or Config.DATABASE_PATH
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    text_content TEXT,
                    word_count INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            # Migration: documents created from a reusable template keep a link to it.
            # Nullable so existing rows are untouched; cleared when the template is deleted.
            columns = {row['name'] for row in cursor.execute("PRAGMA table_info(documents)")}
            if 'template_id' not in columns:
                cursor.execute("ALTER TABLE documents ADD COLUMN template_id TEXT")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id)")
            conn.commit()

    def get_all_documents(self) -> list:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, title, text_content, word_count, template_id, created_at, updated_at
                FROM documents
                ORDER BY updated_at DESC
            """)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_document(self, doc_id: str) -> dict:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            if not row:
                return None
            doc = dict(row)
            # Try parsing json content if formatted as json
            try:
                doc['content_json'] = json.loads(doc['content'])
            except Exception:
                doc['content_json'] = None
            return doc

    def create_document(self, title: str, content: str, text_content: str = "", word_count: int = 0,
                        template_id: str = None) -> dict:
        doc_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + "Z"
        title = title.strip() or "Untitled Document"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO documents (id, title, content, text_content, word_count, template_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (doc_id, title, content, text_content, word_count, template_id, now, now))
            conn.commit()

        return self.get_document(doc_id)

    def update_document(self, doc_id: str, title: str = None, content: str = None, text_content: str = None, word_count: int = None) -> dict:
        existing = self.get_document(doc_id)
        if not existing:
            return None

        now = datetime.utcnow().isoformat() + "Z"
        new_title = title.strip() if title is not None else existing['title']
        new_content = content if content is not None else existing['content']
        new_text_content = text_content if text_content is not None else existing.get('text_content', '')
        new_word_count = word_count if word_count is not None else existing.get('word_count', 0)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE documents
                SET title = ?, content = ?, text_content = ?, word_count = ?, updated_at = ?
                WHERE id = ?
            """, (new_title, new_content, new_text_content, new_word_count, now, doc_id))
            conn.commit()

        return self.get_document(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            conn.commit()
            return cursor.rowcount > 0

# Singleton instance
document_service = DocumentService()
