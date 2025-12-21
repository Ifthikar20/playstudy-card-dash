# Encryption in Transit - Implementation Guide

## Overview

This document explains how encryption in transit works for sensitive endpoints like mentor content generation and transcript delivery.

## Architecture

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
│  (Browser)  │                    │  (Backend)  │
└─────────────┘                    └─────────────┘
       │                                  │
       │  1. Fetch public RSA key         │
       ├─────────────────────────────────>│
       │                                  │
       │  2. RSA public key (PEM)         │
       │<─────────────────────────────────┤
       │                                  │
       │  3. Generate AES-256 key         │
       │  4. Encrypt request with AES     │
       │  5. Encrypt AES key with RSA     │
       │  6. Send encrypted request       │
       │     X-Encrypted-Request: true    │
       ├─────────────────────────────────>│
       │                                  │
       │                                  │  7. Decrypt AES key (RSA private)
       │                                  │  8. Decrypt payload (AES-256-GCM)
       │                                  │  9. Process request
       │                                  │  10. Encrypt response (AES-256-GCM)
       │                                  │
       │  11. Encrypted response          │
       │      X-Encrypted-Response: true  │
       │<─────────────────────────────────┤
       │                                  │
       │  12. Decrypt response            │
       │  13. Use plain data              │
       │                                  │
```

## Endpoints Requiring Encryption

The following endpoints **require** encrypted requests in transit:

### 1. Mentor Content Generation
**Endpoint:** `POST /api/tts/generate-mentor-content`

**Why:** AI-generated educational narratives contain user-uploaded study materials and personal learning content.

**Request:**
```json
{
  "topic_id": 123,
  "topic_title": "Introduction to JavaScript",
  "questions": [...]
}
```

**Response:**
```json
{
  "narrative": "Let's dive into JavaScript...",
  "estimated_duration_seconds": 180,
  "mermaid_code": "graph TD...",
  "key_terms": ["variable", "function", "scope"]
}
```

### 2. Study Session Creation
**Endpoint:** `POST /api/study-sessions/create`

**Why:** Contains user-uploaded documents and study materials.

### 3. Document Uploads
**Endpoint:** `POST /api/study-sessions/upload`

**Why:** Raw user documents and files.

## Encryption Flow Details

### Request Encryption (Client → Server)

**Step 1: Client generates AES-256 key**
```javascript
const aesKey = window.crypto.getRandomValues(new Uint8Array(32)); // 256 bits
```

**Step 2: Client encrypts payload**
```javascript
const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
const payload = JSON.stringify(requestData);

const encrypted = await window.crypto.subtle.encrypt(
  { name: "AES-GCM", iv: iv },
  aesKey,
  new TextEncoder().encode(payload)
);
```

**Step 3: Client encrypts AES key with server's RSA public key**
```javascript
const encryptedKey = await window.crypto.subtle.encrypt(
  { name: "RSA-OAEP" },
  serverPublicKey,
  aesKey
);
```

**Step 4: Client sends encrypted request**
```javascript
const requestBody = {
  encryptedKey: base64Encode(encryptedKey),
  encryptedData: base64Encode(encrypted),
  iv: base64Encode(iv),
  nonce: uuidv4(),
  timestamp: Date.now()
};

fetch('/api/tts/generate-mentor-content', {
  method: 'POST',
  headers: {
    'X-Encrypted-Request': 'true',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestBody)
});
```

### Response Encryption (Server → Client)

**Step 1: Server generates AES-256 key**
```python
aes_key = os.urandom(32)  # 256-bit key
nonce = os.urandom(12)    # 96-bit nonce
```

**Step 2: Server encrypts response**
```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

aesgcm = AESGCM(aes_key)
plaintext = json.dumps(response_data).encode('utf-8')
ciphertext = aesgcm.encrypt(nonce, plaintext, None)
```

**Step 3: Server sends encrypted response**
```python
encrypted_response = {
    "encrypted": True,
    "data": base64.b64encode(ciphertext).decode('utf-8'),
    "nonce": base64.b64encode(nonce).decode('utf-8'),
    "algorithm": "AES-256-GCM"
}

return JSONResponse(
    content=encrypted_response,
    headers={
        "X-Encrypted-Response": "true",
        "X-Encryption-Algorithm": "AES-256-GCM"
    }
)
```

## Security Features

### 1. Replay Protection
- **Nonce validation:** Each request must include a unique UUID nonce
- **Timestamp validation:** Requests older than 2 minutes are rejected
- **Nonce cache:** Used nonces are cached for 5 minutes to prevent replay

### 2. Request Signing (Optional)
```javascript
const signature = await hmacSha256(
  `${method}|${url}|${timestamp}|${nonce}|${encryptedData}`,
  clientSecret
);
```

### 3. Authentication
All encrypted endpoints still require valid JWT tokens in the `Authorization` header.

## Error Responses

### Missing Encryption
**Status:** 403 Forbidden
```json
{
  "detail": "This endpoint requires encrypted requests for data protection",
  "error_code": "ENCRYPTION_REQUIRED",
  "hint": "Use X-Encrypted-Request header with encrypted payload"
}
```

### Decryption Failed
**Status:** 400 Bad Request
```json
{
  "detail": "Request decryption failed"
}
```

### Replay Attack Detected
**Status:** 400 Bad Request
```json
{
  "detail": "Invalid timestamp or nonce reuse"
}
```

## Configuration

### Environment Variables

```bash
# Enable encryption for specific endpoints (default: true for sensitive endpoints)
# ENCRYPTION_REQUIRED_ENDPOINTS are always encrypted

# Enable global encryption requirement (default: false)
ENCRYPTION_REQUIRED=false

# RSA Private Key for decrypting AES keys
# Generate with: openssl genrsa -out private.pem 2048
RSA_PRIVATE_KEY_PEM=

# Field encryption key for data at rest
FIELD_ENCRYPTION_KEY=
```

### Toggle Encryption Requirement

**Development (optional encryption):**
```python
ENCRYPTION_REQUIRED = False
ENCRYPTION_REQUIRED_ENDPOINTS = []  # No endpoints require encryption
```

**Production (enforce for sensitive endpoints):**
```python
ENCRYPTION_REQUIRED = False  # Global still optional
ENCRYPTION_REQUIRED_ENDPOINTS = [
    "/api/tts/generate-mentor-content",
    "/api/study-sessions/create",
]
```

**Full Production (all requests encrypted):**
```python
ENCRYPTION_REQUIRED = True  # All POST/PUT/PATCH require encryption
```

## Implementation Checklist

### Backend
- [x] Encryption middleware implemented
- [x] Response encryption for sensitive endpoints
- [x] Request decryption with RSA + AES
- [x] Nonce-based replay protection
- [x] Timestamp validation
- [x] Error handling and logging

### Frontend (TODO)
- [ ] Fetch server's RSA public key on app init
- [ ] Implement AES-256-GCM encryption
- [ ] Implement RSA-OAEP key encryption
- [ ] Add X-Encrypted-Request header
- [ ] Handle encrypted responses
- [ ] Automatic retry on encryption errors

## Performance Considerations

### Encryption Overhead
- **Request encryption:** ~5-10ms for small payloads (<100KB)
- **Response encryption:** ~10-20ms for mentor narratives (5-10KB)
- **RSA key exchange:** ~2-5ms per request

### Optimization Strategies
1. **Caching:** Cache encrypted responses for identical requests
2. **Compression:** Compress plaintext before encryption
3. **Key reuse:** Reuse AES keys within a session (with unique IVs)

## Testing

### Test Encrypted Request
```bash
# 1. Get public key
curl http://localhost:8000/api/crypto/public-key

# 2. Encrypt payload (use client library)
# 3. Send encrypted request
curl -X POST http://localhost:8000/api/tts/generate-mentor-content \
  -H "X-Encrypted-Request: true" \
  -H "Authorization: Bearer $TOKEN" \
  -d @encrypted_payload.json
```

### Test Response Decryption
```javascript
// Client-side decryption
const decryptResponse = async (encryptedResponse) => {
  const { data, nonce } = encryptedResponse;

  // Decrypt with AES key from session
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(nonce) },
    sessionAesKey,
    base64Decode(data)
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
};
```

## Migration Path

### Phase 1: Optional Encryption (Current)
- Encryption middleware active but not enforced
- Endpoints work with both encrypted and plain requests
- Log encryption usage for monitoring

### Phase 2: Enforce for Sensitive Endpoints
- Enable `ENCRYPTION_REQUIRED_ENDPOINTS`
- Mentor content, uploads require encryption
- Other endpoints remain optional

### Phase 3: Full Encryption
- Enable `ENCRYPTION_REQUIRED = True`
- All POST/PUT/PATCH requests require encryption
- Monitor and fix client issues

### Phase 4: Mandatory Encryption
- Remove plaintext support entirely
- All requests and responses encrypted
- Update documentation

## Troubleshooting

### "Encryption required" error
**Cause:** Endpoint requires encryption but request is plain

**Solution:**
1. Check if endpoint is in `ENCRYPTION_REQUIRED_ENDPOINTS`
2. Add `X-Encrypted-Request: true` header
3. Encrypt payload with RSA + AES

### Decryption failed
**Cause:** Invalid encrypted payload or wrong key

**Solution:**
1. Verify RSA public key matches server
2. Check IV and nonce are included
3. Ensure AES-256-GCM algorithm used
4. Verify base64 encoding is correct

### Replay attack detected
**Cause:** Nonce reused or timestamp too old

**Solution:**
1. Generate new UUID nonce for each request
2. Use current timestamp (within 2 minutes)
3. Don't retry with same nonce

## References

- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST SP 800-38D (GCM)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
