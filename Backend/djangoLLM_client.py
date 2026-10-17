#!/usr/bin/env python3
# djangoLLM_client.py
"""
Django LLM Gateway Client
A Python client to interact with the Django LLM gateway server.

Adapted from the project's reference DjangoLLMClient. The public API
(authenticate, query_llm, query_with_image, get_quota_status, ...) and the
gateway request/response formats are unchanged. Differences:

- Credentials (email/OTP) and the gateway URL come from constructor
  arguments or environment variables; nothing is hardcoded.
- Every HTTP call has a timeout.
- Diagnostic output goes through `logging` and never includes the OTP or
  the bearer token.
- PyJWT is optional: token expiry is read from the JWT payload directly when
  PyJWT isn't installed.

Environment variables (see Backend/.env.example):
    DJANGO_LLM_BASE_URL   Gateway base URL
    DJANGO_LLM_EMAIL      Account email used for /api/token/
    DJANGO_LLM_OTP        OTP / access code used for /api/token/
    DJANGO_LLM_TIMEOUT    Request timeout in seconds (default 120)
"""

import argparse
import base64
import json
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional

import requests

try:  # Optional dependency, only used to read the token's `exp` claim
    import jwt  # type: ignore
except ImportError:  # pragma: no cover - depends on environment
    jwt = None

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "http://ragsuite-online-api.felamity.com"
DEFAULT_TIMEOUT = 120


def _env_timeout() -> float:
    try:
        return float(os.getenv("DJANGO_LLM_TIMEOUT", DEFAULT_TIMEOUT))
    except ValueError:
        return float(DEFAULT_TIMEOUT)


def _decode_jwt_exp(token: str) -> Optional[float]:
    """Return the `exp` claim of a JWT without verifying its signature."""
    if not token:
        return None
    if jwt is not None:
        try:
            return jwt.decode(token, options={"verify_signature": False}).get("exp")
        except Exception:
            return None
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("exp")
    except Exception:
        return None


class DjangoLLMClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        email: Optional[str] = None,
        otp: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.base_url = (base_url or os.getenv("DJANGO_LLM_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.token = token
        self.email = email if email is not None else os.getenv("DJANGO_LLM_EMAIL", "")  # Stored for auto-renewal
        self.otp = otp if otp is not None else os.getenv("DJANGO_LLM_OTP", "")  # Stored for auto-renewal
        self.timeout = timeout if timeout is not None else _env_timeout()
        self.session = requests.Session()
        self.token_expires_at = None  # Track token expiry
        self.auto_renew = True  # Enable automatic renewal

        if self.token:
            self._set_auth_headers()

    @property
    def is_configured(self) -> bool:
        """True when credentials are available to obtain a token."""
        return bool(self.token or (self.email and self.otp))

    def _set_auth_headers(self):
        """Set authentication headers"""
        self.session.headers.update({
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        })

    def authenticate(self, email: Optional[str] = None, otp: Optional[str] = None) -> Optional[str]:
        """Get authentication token"""
        email = email if email is not None else self.email
        otp = otp if otp is not None else self.otp
        if not email or not otp:
            logger.warning("LLM gateway authentication skipped: email/OTP not configured")
            return None

        url = f"{self.base_url}/api/token/"
        try:
            response = self.session.post(url, json={"email": email, "otp": otp}, timeout=self.timeout)
        except requests.exceptions.RequestException as e:
            logger.warning("LLM gateway authentication request failed: %s", type(e).__name__)
            return None

        if response.status_code == 200:
            try:
                data = response.json()
            except ValueError:
                logger.warning("LLM gateway authentication returned a non-JSON response")
                return None
            self.token = data.get('access')
            if not self.token:
                logger.warning("LLM gateway authentication response did not include an access token")
                return None
            self.email = email  # Store for auto-renewal
            self.otp = otp  # Store for auto-renewal

            # Calculate token expiry (JWT with standard exp claim); estimate 24 hours otherwise
            self.token_expires_at = _decode_jwt_exp(self.token) or (time.time() + 24 * 3600)

            self._set_auth_headers()
            logger.info("Authenticated with LLM gateway")
            return self.token

        logger.warning("LLM gateway authentication failed with HTTP %s", response.status_code)
        return None

    def _is_token_expired(self) -> bool:
        """Check if token is expired or close to expiry"""
        if not self.token_expires_at:
            return False

        # Renew 5 minutes before expiry
        buffer_time = 5 * 60
        return time.time() >= (self.token_expires_at - buffer_time)

    def _renew_token(self) -> bool:
        """Automatically renew expired token"""
        if not self.email or not self.auto_renew:
            return False

        # Clear old token to avoid using it during renewal
        old_token = self.token
        self.token = None
        self.session.headers.pop('Authorization', None)

        try:
            new_token = self.authenticate(self.email, self.otp)
            if new_token:
                return True
            # Restore old token as fallback
            self.token = old_token
            if old_token:
                self._set_auth_headers()
            return False
        except Exception:
            # Restore old token as fallback
            self.token = old_token
            if old_token:
                self._set_auth_headers()
            return False

    def _make_authenticated_request(self, method: str, url: str, **kwargs) -> requests.Response:
        """
        Make request with automatic token renewal on 401 errors
        """
        kwargs.setdefault('timeout', self.timeout)

        # Obtain a token on first use, or renew it when close to expiry
        if not self.token or self._is_token_expired():
            self._renew_token()

        # Make the request
        response = getattr(self.session, method.lower())(url, **kwargs)

        # If we get 401, try to renew token once and retry
        if response.status_code == 401 and self.auto_renew:
            if self._renew_token():
                # Retry the request with new token
                response = getattr(self.session, method.lower())(url, **kwargs)

        return response

    def query_llm(self,
                  provider: str,
                  model: str,
                  messages: List[Dict],
                  stream: bool = False,
                  complexity_score: float = 0.3,
                  stop_event=None,
                  **generation_params) -> Dict:
        """
        Query LLM with text or multimodal content

        Args:
            provider: Provider name as the gateway lists it in /api/quota/
                      (e.g. "OpenAI", "Gemini", "Amazon Bedrock", "Mistral")
            model: Model name
            messages: List of message dictionaries
            stream: Whether to use streaming
            **generation_params: Additional parameters (temperature, top_p, etc.)

        Returns the gateway's JSON response (with a `content` key on success)
        or a dict with an `error` key. With stream=True a generator is
        returned, as in the reference client.
        """
        url = f"{self.base_url}/api/llm/query/"

        payload = {
            "provider": provider,
            "model": model,
            "messages": messages,
            "stream": stream,
            "complexity_score": complexity_score,
            **generation_params
        }

        if stream:
            return self._handle_streaming_response(url, payload, stop_event)
        return self._handle_regular_response(url, payload)

    def _handle_regular_response(self, url: str, payload: Dict) -> Dict:
        """Handle regular (non-streaming) response"""
        try:
            response = self._make_authenticated_request('POST', url, json=payload)

            if response.status_code == 200:
                data = response.json()
                self._display_response(data)
                return data

            if response.headers.get('content-type', '').startswith('application/json'):
                error_data = response.json()
            else:
                error_data = {"error": response.text}
            if isinstance(error_data, dict):
                error_data.setdefault("status_code", response.status_code)
            else:
                error_data = {"error": str(error_data), "status_code": response.status_code}
            return error_data

        except requests.exceptions.Timeout:
            return {"error": "Request timeout - server took too long to respond"}
        except requests.exceptions.ConnectionError:
            return {"error": "Connection error - unable to reach server"}
        except requests.exceptions.RequestException as e:
            return {"error": f"Request error: {type(e).__name__}"}
        except ValueError:
            return {"error": "LLM gateway returned an invalid JSON response"}

    def _handle_streaming_response(self, url: str, payload: Dict, stop_event=None):
        """Handle streaming response with better error handling"""
        try:
            response = self._make_authenticated_request('POST', url, json=payload, stream=True)

            # Better error handling for non-200 responses
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', response.text)
                    return {"error": error_msg, "status_code": response.status_code}
                except json.JSONDecodeError:
                    error_msg = response.text or f"HTTP {response.status_code} error"
                    return {"error": error_msg, "status_code": response.status_code}

            # Process successful streaming response
            full_content = ""
            total_tokens = 0
            usage_info = {}

            for line in response.iter_lines(decode_unicode=True):
                if stop_event and stop_event.is_set():
                    stop_response = {
                        "content": "",
                        "done": True,
                        "stopped": True,
                        "usage": {"total_tokens": total_tokens}
                    }
                    yield json.dumps(stop_response) + "\n"
                    return
                if line and line.startswith('data: '):
                    try:
                        chunk_data = json.loads(line[6:])
                        if 'error' in chunk_data:
                            return chunk_data

                        if not chunk_data.get('done', False):
                            content = chunk_data.get('content', '')
                            yield json.dumps({"type": "text", "text": content}) + "\n"
                            full_content += content
                            total_tokens += len(content.split()) * 1.3  # Rough estimation
                        else:
                            usage_info = chunk_data.get('usage', {})
                            break

                    except json.JSONDecodeError:
                        continue

            return {
                "content": full_content,
                "usage": usage_info,
                "streaming": True
            }

        except requests.exceptions.Timeout:
            return {"error": "Request timeout - server took too long to respond"}

        except requests.exceptions.ConnectionError:
            return {"error": "Connection error - unable to reach server"}

        except requests.exceptions.RequestException as e:
            return {"error": f"Request error: {type(e).__name__}"}

    def _display_response(self, data: Dict):
        """Log routing/usage metadata of a response (never the content or credentials)."""
        if not isinstance(data, dict):
            return
        usage = data.get('usage') or {}
        routing = data.get('model_routing') or {}
        if usage or routing:
            logger.debug("LLM gateway usage=%s routing=%s", usage, routing.get('routing_info', {}))

    def encode_image(self, image_path: str) -> Optional[str]:
        """
        Encode image to base64 data URL with proper media type

        Args:
            image_path: Path to the image file

        Returns:
            str: Data URL in format "data:image/<type>;base64,<base64_data>"
                  or None if encoding fails
        """
        try:
            # Get file extension and detect MIME type
            file_ext = Path(image_path).suffix.lower()

            # Map common extensions to media types
            media_type_map = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.webp': 'image/webp',
                '.bmp': 'image/bmp',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
                '.tiff': 'image/tiff',
                '.tif': 'image/tiff'
            }

            media_type = media_type_map.get(file_ext, 'application/octet-stream')

            # Read and encode image
            with open(image_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode('utf-8')

            return f"data:{media_type};base64,{image_data}"

        except FileNotFoundError:
            logger.warning("Image file not found: %s", image_path)
            return None
        except Exception as e:
            logger.warning("Error encoding image %s: %s", image_path, e)
            return None

    def query_with_image(self,
                         provider: str,
                         model: str,
                         messages: List[Dict],
                         image_paths: List[str],
                         stop_event=None,
                         complexity_score=0.7,
                         **generation_params) -> Dict:
        """Query LLM with text and images"""

        # Build multimodal message
        res_messages = [{'role': 'system', 'content': []}, {'role': 'user', 'content': []}]
        if messages:
            # The reference CLI passes a bare string here; accept both forms
            if isinstance(messages, str):
                messages = [{'role': 'user', 'content': messages}]
            for msg in messages:
                role = msg.get('role', 'user')
                if role == 'system':
                    res_messages[0]['content'].append({'type': 'text', 'text': msg['content']})
                else:
                    res_messages[1]['content'].append({'type': 'text', 'text': msg['content']})

        for image_path in image_paths:
            if os.path.exists(image_path):
                image_data = self.encode_image(image_path)
                if image_data:
                    res_messages[1]['content'].append({
                        "type": "image_url",
                        "image_url": {"url": image_data}
                    })

        # Drop the system message when none was supplied
        if not res_messages[0]['content']:
            res_messages = res_messages[1:]

        return self.query_llm(provider, model, res_messages, **generation_params)

    def get_quota_status(self) -> Dict:
        """Get user's quota status"""
        url = f"{self.base_url}/api/quota/"
        try:
            response = self._make_authenticated_request('GET', url)
            if response.status_code == 200:
                return response.json()
            return {}
        except Exception:
            return {}

    def admin_panel(self):
        url = f"{self.base_url}/api/admin_panel/"
        try:
            response = self._make_authenticated_request('GET', url)
            if response.status_code == 200:
                return response.json()
            return {}
        except Exception:
            return {}

    def logout_device(self, otp="", session_id=""):
        url = f"{self.base_url}/api/logout/device/"
        response = self._make_authenticated_request('POST', url, json={"otp": otp, "session_id": session_id})
        return response.text, response.status_code

    def mistral_ocr_result(self, images_list):
        url = f"{self.base_url}/api/mistral_ocr_result/"
        response = self._make_authenticated_request('POST', url, json={"images": images_list})
        if response.status_code == 200:
            return response.json()
        return None

    def cloud_vector(self):
        url = f"{self.base_url}/api/cloud_vector/"
        try:
            response = self._make_authenticated_request('GET', url)
            if response.status_code == 200:
                return response.json()
            return {}
        except Exception:
            return {}

    def model_catalog(self):
        url = f"{self.base_url}/api/model_catalog/"
        try:
            response = self._make_authenticated_request('GET', url)
            if response.status_code == 200:
                return response.json()
            return {}
        except Exception:
            return {}


def main():
    parser = argparse.ArgumentParser(description='Django LLM Gateway Client')
    parser.add_argument('--server', default=os.getenv('DJANGO_LLM_BASE_URL', DEFAULT_BASE_URL),
                        help='Django server URL')
    parser.add_argument('--email', default=os.getenv('DJANGO_LLM_EMAIL'),
                        help='User email for authentication (default: $DJANGO_LLM_EMAIL)')
    parser.add_argument('--otp', default=os.getenv('DJANGO_LLM_OTP'),
                        help='OTP for authentication (default: $DJANGO_LLM_OTP)')
    # The gateway validates provider names as listed by /api/quota/
    # (e.g. "OpenAI", "Gemini", "Amazon Bedrock", "Mistral").
    parser.add_argument('--provider', default=os.getenv('DJANGO_LLM_PROVIDER', 'OpenAI'),
                        help='LLM provider as named by the gateway (e.g. OpenAI, Gemini, "Amazon Bedrock", Mistral)')
    parser.add_argument('--model', help='Model name (optional, will use provider default)')
    parser.add_argument('--text', help='Text to send to LLM')
    parser.add_argument('--images', nargs='*', help='Image file paths')
    parser.add_argument('--stream', action='store_true', help='Use streaming response')
    parser.add_argument('--temperature', type=float, help='Temperature (0.0-2.0)')
    parser.add_argument('--top-p', type=float, help='Top-p (0.0-1.0)')
    parser.add_argument('--max-tokens', type=int, help='Maximum tokens')
    parser.add_argument('--interactive', action='store_true', help='Interactive mode')

    args = parser.parse_args()

    # Initialize client
    client = DjangoLLMClient(base_url=args.server, email=args.email or '', otp=args.otp or '')

    # Authenticate
    if not client.authenticate():
        print("❌ Authentication failed (check DJANGO_LLM_EMAIL / DJANGO_LLM_OTP)")
        return

    # Model mapping
    model_defaults = {
        'OpenAI': 'gpt-5',
        'Gemini': 'gemini-3-flash-preview',
        'Amazon Bedrock': 'claude-haiku-4.5',
        'Mistral': 'mistral-pixtral-combo',
    }

    model = args.model or model_defaults.get(args.provider, 'default')

    # Build generation parameters
    gen_params = {}
    if args.temperature is not None:
        gen_params['temperature'] = args.temperature
    if args.top_p is not None:
        gen_params['top_p'] = args.top_p
    if args.max_tokens is not None:
        if args.provider == 'OpenAI':
            gen_params['max_completion_tokens'] = args.max_tokens
        else:
            gen_params['max_tokens'] = args.max_tokens

    if args.interactive:
        print("\n🤖 Interactive LLM Chat")
        print("Type 'quit' to exit, 'switch <provider>' to change provider")
        print(f"Current: {args.provider} / {model}")
        print("-" * 50)

        current_provider = args.provider
        current_model = model

        while True:
            try:
                user_input = input(f"\n[{current_provider}] You: ").strip()

                if user_input.lower() == 'quit':
                    break
                elif user_input.startswith('switch '):
                    new_provider = user_input.split(' ', 1)[1]
                    if new_provider in model_defaults:
                        current_provider = new_provider
                        current_model = model_defaults[new_provider]
                        print(f"✅ Switched to {current_provider} / {current_model}")
                    else:
                        print(f"❌ Unknown provider: {new_provider}")
                    continue
                elif not user_input:
                    continue

                messages = [{"role": "user", "content": user_input}]
                print(f"\n[{current_provider}] Assistant: ", end="")
                result = client.query_llm(current_provider, current_model, messages, **gen_params)
                print(result.get('content') or result.get('error'))

            except KeyboardInterrupt:
                print("\n👋 Goodbye!")
                break

    elif args.text:
        if args.images:
            result = client.query_with_image(
                args.provider, model, [{"role": "user", "content": args.text}], args.images, **gen_params
            )
        else:
            messages = [{"role": "user", "content": args.text}]
            result = client.query_llm(args.provider, model, messages, stream=args.stream, **gen_params)
        if isinstance(result, dict):
            print(result.get('content') or result.get('error'))
        else:
            for chunk in result:
                print(json.loads(chunk).get('text', ''), end='', flush=True)
            print()

    else:
        print("❌ Please provide --text or use --interactive mode")


if __name__ == "__main__":
    main()
