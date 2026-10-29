#ragsuite_agent_client.py
import requests
import json
import logging
import os
import re
import uuid
from urllib.parse import urlsplit

from flask import Blueprint, jsonify, request

from config import Config

logger = logging.getLogger(__name__)

SOURCE_NOTE = re.compile(r"^(?:\s*Data fetching from the source:[^\n]*\n)+\s*")
ragsuite_agent_bp = Blueprint("ragsuite_agent", __name__)


@ragsuite_agent_bp.route('/api/eligible_models', methods=['GET'])
def get_eligible_models():
    """Proxy RAGSUITE's eligible-models list so the frontend can show a model picker."""
    ragsuite_base = Config.RAGSUITE_ENDPOINT.rsplit('/', 2)[0]
    url = f"{ragsuite_base}/api/eligible_models"
    try:
        resp = requests.get(url, headers={"Content-Type": "application/json"}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data and "free" in data and "subscription" in data:
            return jsonify(data), 200
        raise ValueError("Invalid data structure from RAGSUITE /api/eligible_models.")
    except requests.exceptions.RequestException as e:
        logger.error("Failed to fetch eligible models: %s", e)
        return jsonify({"error": str(e)}), 502
    except ValueError as e:
        logger.error("Eligible models response invalid: %s", e)
        return jsonify({"error": str(e)}), 502


@ragsuite_agent_bp.route('/api/models/load', methods=['POST'])
def load_model():
    """Load a model in RAGSUITE and update the backend's LLM client to use it."""
    body = request.get_json(silent=True) or {}
    model_id = body.get("model_id", "")
    vendor = body.get("vendor", "")
    supports_vision = body.get("supports_vision", False)

    if not model_id:
        return jsonify({"error": "model_id is required."}), 400

    ragsuite_base = Config.RAGSUITE_ENDPOINT.rsplit('/', 2)[0]
    url = f"{ragsuite_base}/model-info/load"
    payload = {"model_id": model_id, "vendor": vendor, "supports_vision": supports_vision}

    try:
        resp = requests.post(url, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        # Import lazily because the extraction service imports this client module.
        from services.template_extraction_service import get_llm_client
        client = get_llm_client()
        client.model_id = model_id
        logger.info("Model loaded in RAGSUITE and LLM client updated: %s", model_id)

        return jsonify(data), 200
    except requests.exceptions.RequestException as e:
        logger.error("Failed to load model in RAGSUITE: %s", e)
        return jsonify({"error": str(e)}), 502

class RagsuiteAgentClient:
    def __init__(self, endpoint="http://localhost:5641/query-data/HOME"):
        self.endpoint = endpoint

    def authenticate(self, *args, **kwargs):
        """Mock authenticate method since old callers invoke it."""
        return True

    def query_llm(self, messages, **kwargs):
        payload = {
            "prompt": messages,
            "n_ctx": kwargs.get("n_ctx", 10000),
            "max_tokens": kwargs.get("max_tokens", 1500),
            "temperature": kwargs.get("temperature", 0.2),
            "top_k": kwargs.get("top_k", 40),
            "top_p": kwargs.get("top_p", 0.9),
            "repeat_penalty": kwargs.get("repeat_penalty", 1.2),
            "directory_path": kwargs.get("directory_path", ""),
            "current_files": kwargs.get("current_files", {}),
            "chat_index": kwargs.get("chat_index", str(uuid.uuid4())),
            "isWebSearch": kwargs.get("isWebSearch", False),
            "deepthink_response": kwargs.get("deepthink_response", ""),
            "web_search_results": kwargs.get("web_search_results", ""),
            "exclude_folders": kwargs.get("exclude_folders", ""),
            "storage_type": kwargs.get("storage_type", "local"),
            "cloud_index_data": kwargs.get("cloud_index_data", {})
        }

        try:
            response = requests.post(self.endpoint, json=payload, stream=True, timeout=300)
            response.raise_for_status()

            full_text = ""
            for line in response.iter_lines():
                if not line:
                    continue
                try:
                    decoded_line = line.decode('utf-8')
                    data = json.loads(decoded_line)
                    if data.get("type") == "text":
                        full_text += data.get("text", "")
                except json.JSONDecodeError:
                    continue

            return full_text
        except requests.exceptions.RequestException as e:
            error = {"error": str(e)}
            if isinstance(e, requests.exceptions.ConnectionError):
                error["error"] = (f"Connection error -  "
                                  "Open the RAGSUITE app and try again")
            elif isinstance(e, requests.exceptions.Timeout):
                error["error"] = "Timeout - RAGSUITE took too long to respond"
            # Prefer RAGSUITE's own message (e.g. "Model not loaded...") over "400 Client Error"
            if e.response is not None:
                error["status_code"] = e.response.status_code
                try:
                    body = e.response.json()
                    if isinstance(body, dict) and body.get("error"):
                        error["error"] = str(body["error"])
                except ValueError:
                    pass
            return error


class RagsuiteCompatClient(RagsuiteAgentClient):
    """
    RAGSUITE client for template structure extraction: query_llm(messages, ...)
    and query_with_image(messages, image_paths, ...) returning {"content": ...}
    or {"error": ...}.

    RAGSUITE answers only after a model has been loaded (the "Select AI Model"
    step of its UI). When it reports that none is loaded and `model_id` is set,
    that model is loaded the same way the UI does it and the query is retried once.
    """

    # RAGSUITE needs no credentials
    is_configured = True

    # RAGSUITE ignores max_tokens and stops answers at about 4k tokens; pretty-printed JSON
    # for a long template does not fit in that, minified JSON does
    OUTPUT_NOTE = "Output the JSON minified on a single line (no indentation or line breaks)."

    def __init__(self, endpoint="http://localhost:5641/query-data/HOME", model_id=""):
        super().__init__(endpoint)
        self.model_id = model_id
        parts = urlsplit(endpoint)
        self.base_url = f"{parts.scheme}://{parts.netloc}"

    @classmethod
    def _fold_system(cls, messages):
        """RAGSUITE ignores system messages, so put their text at the start of the first user message."""
        system = "\n\n".join([m["content"] for m in messages
                              if m.get("role") == "system" and isinstance(m.get("content"), str)]
                             + [cls.OUTPUT_NOTE])
        rest = [dict(m) for m in messages if m.get("role") != "system"]
        if system:
            first_user = next((m for m in rest if m.get("role") == "user" and isinstance(m.get("content"), str)), None)
            if first_user is None:
                rest.insert(0, {"role": "user", "content": system})
            else:
                first_user["content"] = system + "\n\n" + first_user["content"]
        return rest

    def query_llm(self, *args, **kwargs):
        # Support query_llm(messages, **kwargs)
        # or legacy query_llm(provider, model, messages, **kwargs)
        if len(args) == 1:
            messages = args[0]
        elif len(args) >= 3:
            messages = args[2]
        else:
            messages = kwargs.pop("messages", None) or (args[0] if args else [])
        kwargs.pop("provider", None)
        kwargs.pop("model", None)
        kwargs.pop("stream", None)
        kwargs.pop("complexity_score", None)

        messages = self._fold_system(messages)
        result = super().query_llm(messages, **kwargs)
        if isinstance(result, dict) and "model not loaded" in result.get("error", "").lower():
            load_error = self.load_model()
            if load_error:
                return {"error": load_error}
            result = super().query_llm(messages, **kwargs)
        if isinstance(result, dict):
            return result
        return {"content": result}

    def load_model(self):
        """Load `model_id` in RAGSUITE. Returns None on success, else an error message."""
        if not self.model_id:
            return (f"RAGSUITE has no model loaded. Select an AI model in RAGSUITE ({self.base_url}) "
                    "or set RAGSUITE_MODEL_ID in Backend/.env")
        try:
            eligible = requests.get(f"{self.base_url}/api/eligible_models", timeout=30)
            eligible.raise_for_status()
            data = eligible.json()
            models = [m for tier in ("free", "subscription") for m in data.get(tier) or []]
            match = next((m for m in models if m.get("model_id") == self.model_id), None)
            if match is None:
                available = ", ".join(m.get("model_id", "?") for m in models)
                return f"RAGSUITE model '{self.model_id}' is not available. Available: {available}"
            if match.get("exceeded"):
                return f"RAGSUITE usage limit reached for model '{self.model_id}'"
            logger.info("Loading RAGSUITE model %s", self.model_id)
            response = requests.post(f"{self.base_url}/model-info/load", json={
                "model_id": self.model_id,
                "vendor": match.get("provider"),
                "supports_vision": match.get("supports_vision", False),
            }, timeout=300)
            response.raise_for_status()
            return None
        except (requests.exceptions.RequestException, ValueError, AttributeError) as e:
            return f"RAGSUITE could not load model '{self.model_id}': {e}"

    def query_with_image(self, *args, **kwargs):
        """
        Same as query_llm, with page images attached the way RAGSUITE's chat attaches files:
        their absolute paths under current_files[chat_index]["RAGSUITE_CACHE"], read by RAGSUITE
        from disk (it runs on this machine). The files must exist until the call returns.
        Supports query_with_image(messages, image_paths, ...) or legacy
        query_with_image(provider, model, messages, image_paths, ...).
        """
        if len(args) >= 4:
            messages = args[2]
            image_paths = args[3]
        elif len(args) == 2:
            messages = args[0]
            image_paths = args[1]
        else:
            messages = kwargs.pop("messages", args[0] if len(args) > 0 else [])
            image_paths = kwargs.pop("image_paths", args[1] if len(args) > 1 else [])
        kwargs.pop("provider", None)
        kwargs.pop("model", None)
        kwargs.pop("stream", None)
        kwargs.pop("complexity_score", None)

        chat_index = str(uuid.uuid4())  # a fresh chat, so no other attachments ride along
        kwargs["chat_index"] = chat_index
        kwargs["current_files"] = {
            chat_index: {"RAGSUITE_CACHE": [os.path.abspath(path) for path in image_paths]}}
        result = self.query_llm(messages, **kwargs)
        if isinstance(result.get("content"), str):
            # RAGSUITE starts the answer with a "Data fetching from the source: <path>" line per file
            result["content"] = SOURCE_NOTE.sub("", result["content"])
        return result
