#ragsuite_client.py
import requests
import json
import logging
import uuid
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)

class RagsuiteClient:
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
                error["error"] = (f"Connection error - RAGSUITE is not running at {self.endpoint}. "
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


class RagsuiteCompatClient(RagsuiteClient):
    """
    RagsuiteClient behind the DjangoLLMClient call signature used by the
    template extraction service: query_llm(provider, model, messages, ...)
    returning {"content": ...} or {"error": ...}. provider/model and the
    gateway-only options (stream, complexity_score) are not sent to RAGSUITE.

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

    def query_llm(self, provider, model, messages, stream=False, complexity_score=None, **generation_params):
        messages = self._fold_system(messages)
        result = super().query_llm(messages, **generation_params)
        if isinstance(result, dict) and "model not loaded" in result.get("error", "").lower():
            load_error = self.load_model()
            if load_error:
                return {"error": load_error}
            result = super().query_llm(messages, **generation_params)
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

    def query_with_image(self, provider, model, messages, image_paths, **kwargs):
        # The RAGSUITE payload has no image input; sending only the text would let
        # the model guess the structure of a scanned page it never saw.
        return {"error": "RAGSUITE does not accept page images. Scanned PDFs need LLM_CLIENT=django"}
