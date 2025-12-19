"""
Encryption Middleware

FastAPI middleware that handles request/response encryption.
Supports dual-mode operation for gradual migration:
- Encrypted requests (with X-Encrypted-Request header)
- Plain requests (standard JSON)
"""

import json
import logging
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.crypto import crypto_service
from app.core.nonce_manager import nonce_manager

logger = logging.getLogger(__name__)

# Feature flag: Require encryption for all requests (default: false for gradual rollout)
ENCRYPTION_REQUIRED = False  # Set to True after migration

# Endpoints that are exempt from encryption (always plain)
EXEMPT_ENDPOINTS = [
    "/health",
    "/api/crypto/public-key",
    "/api/crypto/key-version",
    "/api/crypto/health",
    "/api/crypto/nonce-stats",
    "/docs",
    "/redoc",
    "/openapi.json",
]


class EncryptionMiddleware(BaseHTTPMiddleware):
    """Middleware to handle request/response encryption"""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable):
        """Process request and response"""

        # Check if endpoint is exempt from encryption
        if self.is_exempt_endpoint(request.url.path):
            return await call_next(request)

        # Check if request is encrypted
        is_encrypted = request.headers.get("X-Encrypted-Request") == "true"

        if is_encrypted:
            # Decrypt request
            try:
                decrypted_request = await self.decrypt_request(request)
                if decrypted_request is None:
                    return JSONResponse(
                        status_code=400,
                        content={"detail": "Request decryption failed"}
                    )

                # Store decrypted data in request state
                request.state.decrypted_data = decrypted_request

            except Exception as e:
                logger.error(f"[EncryptionMiddleware] Decryption error: {e}")
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid encrypted request"}
                )

        elif ENCRYPTION_REQUIRED and request.method in ["POST", "PUT", "PATCH"]:
            # Encryption required but request is plain
            logger.warning(f"[EncryptionMiddleware] Unencrypted request rejected: {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"detail": "Encrypted requests required"}
            )

        # Process request
        response = await call_next(request)

        # TODO: Add response encryption when needed
        # For now, responses are sent in plain JSON

        return response

    def is_exempt_endpoint(self, path: str) -> bool:
        """Check if endpoint is exempt from encryption"""
        for exempt in EXEMPT_ENDPOINTS:
            if path.startswith(exempt):
                return True
        return False

    async def decrypt_request(self, request: Request) -> dict | None:
        """
        Decrypt an encrypted request

        Expected request body format:
        {
            "encryptedKey": "base64...",
            "encryptedData": "base64...",
            "iv": "base64...",
            "authTag": "base64...",
            "nonce": "uuid",
            "timestamp": 1234567890,
            "signature": "base64...",
            "keyVersion": "v1"
        }
        """
        try:
            # Parse request body
            body = await request.body()
            encrypted_payload = json.loads(body)

            # Extract components
            encrypted_key_b64 = encrypted_payload.get("encryptedKey")
            encrypted_data_b64 = encrypted_payload.get("encryptedData")
            iv_b64 = encrypted_payload.get("iv")
            auth_tag_b64 = encrypted_payload.get("authTag")
            nonce = encrypted_payload.get("nonce")
            timestamp = encrypted_payload.get("timestamp")
            signature = encrypted_payload.get("signature")
            key_version = encrypted_payload.get("keyVersion", "v1")

            # Validate required fields
            if not all([encrypted_key_b64, encrypted_data_b64, iv_b64, auth_tag_b64, nonce, timestamp]):
                logger.error("[EncryptionMiddleware] Missing required fields in encrypted request")
                return None

            # 1. Validate timestamp (2-minute window)
            if not crypto_service.validate_timestamp(timestamp, max_age=120):
                logger.warning(f"[EncryptionMiddleware] Invalid timestamp: {timestamp}")
                return None

            # 2. Verify nonce (replay protection)
            if not nonce_manager.verify_nonce(nonce, ttl=300):
                logger.warning(f"[EncryptionMiddleware] Replay attack detected: {nonce[:16]}...")
                return None

            # 3. Verify signature (if provided)
            if signature:
                method = request.method
                url = str(request.url.path)
                if not crypto_service.verify_signature(
                    method, url, timestamp, nonce, encrypted_data_b64, signature
                ):
                    logger.warning("[EncryptionMiddleware] Signature verification failed")
                    return None

            # 4. Decrypt AES key with RSA
            aes_key = crypto_service.decrypt_aes_key(encrypted_key_b64)

            # 5. Decrypt payload with AES
            decrypted_data = crypto_service.decrypt_payload(
                encrypted_data_b64,
                aes_key,
                iv_b64,
                auth_tag_b64
            )

            # 6. Remove replay protection metadata
            if "_meta" in decrypted_data:
                meta = decrypted_data.pop("_meta")
                logger.debug(f"[EncryptionMiddleware] Meta: {meta}")

            logger.info(f"[EncryptionMiddleware] ✅ Request decrypted successfully")
            return decrypted_data

        except json.JSONDecodeError as e:
            logger.error(f"[EncryptionMiddleware] JSON decode error: {e}")
            return None
        except ValueError as e:
            logger.error(f"[EncryptionMiddleware] Decryption error: {e}")
            return None
        except Exception as e:
            logger.error(f"[EncryptionMiddleware] Unexpected error: {e}")
            return None


# Helper function to get decrypted data from request
def get_decrypted_data(request: Request) -> dict | None:
    """Get decrypted data from request state (if available)"""
    return getattr(request.state, "decrypted_data", None)
