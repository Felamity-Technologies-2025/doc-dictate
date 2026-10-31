"""
Minimal JSON-file persistence shared by DocumentService and TemplateService.

The whole dataset lives in one JSON file:

    {"documents": [...], "templates": [...], "template_fields": [...], "template_images": [...]}

Every operation runs inside `transaction()` (or `read()`): a process-wide lock
serialises access, the file is re-read on entry, and writes go to a temp file
that is atomically swapped in on success. An exception inside a transaction
discards the changes, so multi-step updates stay all-or-nothing.
"""
import json
import logging
import os
import tempfile
import threading
from contextlib import contextmanager

logger = logging.getLogger(__name__)

COLLECTIONS = ('documents', 'templates', 'template_fields', 'template_images')


class JsonStore:
    def __init__(self, path: str):
        self.path = os.path.abspath(path)
        self._lock = threading.RLock()
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with self._lock:
            if not os.path.exists(self.path):
                self._write(self._empty())

    @staticmethod
    def _empty() -> dict:
        return {name: [] for name in COLLECTIONS}

    def _load(self) -> dict:
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            return self._empty()
        if not isinstance(data, dict):
            raise ValueError(f'{self.path} must contain a JSON object')
        for name in COLLECTIONS:
            data.setdefault(name, [])
        return data

    def _write(self, data: dict) -> None:
        fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(self.path), prefix='.store-', suffix='.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, self.path)
        except BaseException:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise

    @contextmanager
    def read(self):
        """Yield the data for reading; changes made to it are not saved."""
        with self._lock:
            yield self._load()

    @contextmanager
    def transaction(self):
        """Yield the data; it is saved when the block exits without an exception."""
        with self._lock:
            data = self._load()
            yield data
            self._write(data)


_stores = {}
_stores_lock = threading.Lock()


def get_store(path: str) -> JsonStore:
    """One JsonStore (and therefore one lock) per file, shared by all services."""
    key = os.path.abspath(path)
    with _stores_lock:
        if key not in _stores:
            _stores[key] = JsonStore(key)
        return _stores[key]
