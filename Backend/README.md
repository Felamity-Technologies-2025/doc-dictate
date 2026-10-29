# Document Editor Backend (Python Flask)

A Python Flask backend providing persistent document storage and reusable template APIs for the document editor.

## Architecture

- **Framework**: Flask with Flask-CORS for cross-origin requests.
- **Persistence**: SQLite database (`documents.db`) storing document title, rich-text HTML/JSON content, word count, and timestamps.

## Setup Instructions

### 1. Prerequisites
- Python 3.10+
### 2. Create Virtual Environment & Install Dependencies

#### On Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### On Linux / macOS (Bash):
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

`config.py` loads `Backend/.env` automatically at startup (real environment variables take precedence).

Optional settings:
- `FLASK_PORT=5000`

### 4. Start the Backend Server
```bash
python app.py
```
The server starts at `http://localhost:5000`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend health and template upload metadata |
| `GET` | `/api/documents` | List all saved documents |
| `POST` | `/api/documents` | Create or save a new document |
| `GET` | `/api/documents/<id>` | Fetch single document by ID |
| `PUT` | `/api/documents/<id>` | Update document |
| `DELETE` | `/api/documents/<id>` | Delete document |
| `GET` | `/api/documents/<id>/export?format=docx\|pdf` | Download the saved document as DOCX or PDF |
| `POST` | `/api/templates/upload` | Upload a PDF or DOCX (`file`, optional `template_name`); the LLM extracts its headings |
| `GET` | `/api/templates` | List templates (with field/document counts) |
| `GET` | `/api/templates/<id>` | Template with its ordered fields |
| `PUT` | `/api/templates/<id>` | Rename (`template_name`) |
| `DELETE` | `/api/templates/<id>` | Delete template; documents made from it are kept and unlinked |
| `POST` | `/api/templates/<id>/fields` | Add custom field (`heading`, `field_type`, `position` \| `after_field_id`, `parent_field_id`) |
| `PUT` | `/api/templates/<id>/fields/<field_id>` | Rename / retype / move (`position`) / re-parent a field |
| `DELETE` | `/api/templates/<id>/fields/<field_id>` | Remove a field from the template |
| `POST` | `/api/templates/<id>/documents` | Create a completed document linked to the template |

## PDF and DOCX Templates (LLM heading extraction)

Users upload a PDF or DOCX (letter, legal opinion, report...). The backend extracts PDF text with
PyMuPDF (pages without a text layer are rendered to images and read by a vision model) or reads
paragraph and table text from DOCX, then sends it to RAGSUITE through
`ragsuite_agent_client.py` and asks for **structure only**: headings, field labels, their order and
nesting. The JSON answer is validated and normalized (values such as `From: Giri Nadhan` are
reduced to `From`) and saved in SQLite. No embeddings, vector store or retrieval are involved.

Opening a template in the editor shows each heading with an empty content area. Users type or
dictate into the active field (Tab / Shift+Tab moves between fields), add their own custom fields,
save the completed document and download it as DOCX or PDF.

### LLM configuration
Set in `Backend/.env`:

| Variable | Purpose |
|---|---|
| `RAGSUITE_ENDPOINT` | RAGSUITE query endpoint (e.g. `http://localhost:5641/query-data/HOME`) |
| `RAGSUITE_MODEL_ID` | Model loaded in RAGSUITE (e.g. `claude-haiku-4.5`) |
| `TEMPLATE_PDF_MAX_BYTES`, `TEMPLATE_PDF_MAX_PAGES`, `TEMPLATE_OCR_MAX_PAGES`, `LLM_MAX_INPUT_CHARS` | Upload and processing limits |

`GET /api/health` reports `llm_gateway_configured` so the UI can check availability.

### Database
Tables are created/migrated automatically in the existing `documents.db`:
- `templates` (id, template_name, original_filename, document_type, extraction_method, timestamps)
- `template_fields` (id, template_id, heading, field_type `field|section|paragraph`, field_order,
  parent_field_id, is_custom, timestamps)
- `documents.template_id` (new nullable column) links completed documents to their template.
  Completed documents store their full content, so editing or deleting a template never changes
  documents that were already saved.
