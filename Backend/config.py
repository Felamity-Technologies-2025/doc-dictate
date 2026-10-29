import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _load_dotenv(path: Path) -> None:
    """Load KEY=VALUE pairs from a .env file without overriding real environment variables."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        if key.startswith('export '):
            key = key[len('export '):].strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        elif ' #' in value:
            value = value.split(' #', 1)[0].rstrip()
        os.environ.setdefault(key, value)


_load_dotenv(BASE_DIR / '.env')


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'word-dictate-dev-secret-key-2026')
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 25 * 1024 * 1024))
    DATABASE_PATH = os.getenv('DATABASE_PATH', str(BASE_DIR / 'documents.db'))

    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')

    # Document templates (PDF/DOCX upload + LLM heading extraction)
    TEMPLATE_PDF_MAX_BYTES = int(os.getenv('TEMPLATE_PDF_MAX_BYTES', 10 * 1024 * 1024))  # 10 MB
    TEMPLATE_PDF_MAX_PAGES = int(os.getenv('TEMPLATE_PDF_MAX_PAGES', 50))
    # Pages rendered to images and sent to the vision model when a PDF has no text layer
    TEMPLATE_OCR_MAX_PAGES = int(os.getenv('TEMPLATE_OCR_MAX_PAGES', 5))
    # Upper bound on extracted text sent to the LLM
    LLM_MAX_INPUT_CHARS = int(os.getenv('LLM_MAX_INPUT_CHARS', 40000))

    # LLM client for template extraction: RAGSUITE (ragsuite_agent_client.py)
    LLM_CLIENT = os.getenv('LLM_CLIENT', 'ragsuite').strip().lower()
    RAGSUITE_ENDPOINT = os.getenv('RAGSUITE_ENDPOINT', 'http://localhost:5641/query-data/HOME')
    # Model loaded in RAGSUITE when it has none loaded (ids as listed by RAGSUITE's /api/eligible_models);
    # empty = select the model in the RAGSUITE app yourself
    RAGSUITE_MODEL_ID = os.getenv('RAGSUITE_MODEL_ID', '')
