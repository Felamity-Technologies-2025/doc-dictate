import os
import platform
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

AGENT_ID = "agent_003"
system = platform.system()
default_product_path = None
print("The OS type is:", system)
if system == "Windows":
    appdata = os.getenv('APPDATA')
    default_product_path = os.path.join(appdata, 'RAGSUITE', 'Agents', AGENT_ID) if appdata else os.path.expanduser(f'~/.local/share/RAGSUITE/Agents/{AGENT_ID}')
elif system == "Linux":
    default_product_path = os.path.expanduser(f'~/.local/share/RAGSUITE/Agents/{AGENT_ID}')
elif system == "Darwin":  #macOS
    default_product_path = os.path.expanduser(f'~/Library/Application Support/RAGSUITE/Agents/{AGENT_ID}')
else:
    default_product_path = os.path.expanduser(f'~/.local/share/RAGSUITE/Agents/{AGENT_ID}')  #Unsupported OS

DATABASE_PATH = os.path.join(default_product_path, 'documents.json')


class Config:
    SECRET_KEY = 'word-dictate-dev-secret-key-2026'
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB, overall request limit
    DATABASE_PATH = DATABASE_PATH

    # CORS
    CORS_ORIGINS = ['*']

    # Document templates (PDF/DOCX upload + LLM heading extraction)
    TEMPLATE_PDF_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
    TEMPLATE_PDF_MAX_PAGES = 50
    # Pages rendered to images and sent to the vision model when a PDF has no text layer
    TEMPLATE_OCR_MAX_PAGES = 5
    # Upper bound on extracted text sent to the LLM
    LLM_MAX_INPUT_CHARS = 40000

    # LLM client for template extraction: RAGSUITE (ragsuite_agent_client.py)
    LLM_CLIENT = 'ragsuite'
    RAGSUITE_ENDPOINT = 'http://localhost:5641/query-data/HOME'
    # Model loaded in RAGSUITE when it has none loaded (ids as listed by RAGSUITE's /api/eligible_models);
    # empty = select the model in the RAGSUITE app yourself
    RAGSUITE_MODEL_ID = ''
