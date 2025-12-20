# Security Architecture

This document outlines the security measures implemented in the PlayStudy backend API.

## Overview

The backend implements multiple layers of security:

1. **Encryption in Transit** - HTTPS/TLS for all API communication
2. **Encryption at Rest** - AES-256 for sensitive database fields
3. **Request/Response Encryption** - Hybrid RSA + AES-256-GCM (optional)
4. **Authentication & Authorization** - JWT-based auth with RBAC
5. **Replay Attack Protection** - Nonce-based validation
6. **Rate Limiting** - SlowAPI for DDoS protection

---

## 1. Encryption in Transit

### TLS/HTTPS
- All production API endpoints must use HTTPS
- TLS 1.2+ required
- Strong cipher suites only

### API Request Encryption (Optional)
For sensitive operations, the API supports end-to-end encryption:

**Encryption Flow:**
1. Client generates random AES-256 key
2. Client encrypts payload with AES-256-GCM
3. Client encrypts AES key with server's RSA-2048 public key
4. Client sends encrypted request with headers:
   - `X-Encrypted-Request: true`
   - `X-Key-Version: v1`

**Server Decryption:**
1. Server decrypts AES key using RSA private key
2. Server decrypts payload using AES key
3. Server validates nonce and timestamp
4. Server verifies HMAC signature

**Implementation:**
- `app/middleware/encryption_middleware.py` - Request/response encryption
- `app/core/crypto.py` - Cryptography service
- `app/core/nonce_manager.py` - Replay protection

---

## 2. Encryption at Rest

### Sensitive Data Encryption

Sensitive user content is encrypted before storing in the database:

**Encrypted Fields:**
- `topics.encrypted_mentor_narrative` - AI-generated lesson content
- Future: User documents, study materials

**Encryption Method:**
- **Algorithm:** Fernet (AES-128-CBC + HMAC-SHA256)
- **Key Management:** Environment variable `FIELD_ENCRYPTION_KEY`
- **Key Rotation:** Supported via versioned keys

**Implementation:**
```python
from app.core.field_encryption import field_encryption

# Encrypt
encrypted = field_encryption.encrypt(plaintext)

# Decrypt
plaintext = field_encryption.decrypt(encrypted)
```

**Database Model:**
```python
class Topic(Base):
    # Encrypted field
    encrypted_mentor_narrative = Column(Text, nullable=True)

    # Helper methods
    def set_mentor_narrative(self, text):
        self.encrypted_mentor_narrative = field_encryption.encrypt(text)

    def get_mentor_narrative(self):
        return field_encryption.decrypt(self.encrypted_mentor_narrative)
```

### Key Management

**Production Requirements:**
1. Set `FIELD_ENCRYPTION_KEY` in environment
2. Store key in secure secret manager (AWS Secrets Manager, Vault, etc.)
3. Never commit keys to version control
4. Rotate keys periodically

**Generate Encryption Key:**
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 3. Authentication & Authorization

### JWT Token Authentication

**Token Structure:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Token Lifecycle:**
- **Expiry:** 7 days
- **Refresh:** Automatic on valid requests
- **Storage:** Client stores in secure storage only

**Protected Endpoints:**
All `/api/*` endpoints require valid JWT token except:
- `/api/auth/login`
- `/api/auth/register`
- `/api/crypto/public-key`

### Authorization

**Role-Based Access Control (RBAC):**
- `user` - Standard user permissions
- `admin` - Full system access
- Future: Premium tier permissions

---

## 4. Replay Attack Protection

### Nonce-Based Validation

**How It Works:**
1. Client generates unique nonce (UUID v4)
2. Client includes nonce and timestamp in request
3. Server validates:
   - Timestamp is within 2-minute window
   - Nonce hasn't been used before
4. Server stores nonce for 5 minutes
5. Request rejected if nonce reused

**Implementation:**
- In-memory cache with TTL
- Automatic cleanup of expired nonces
- Thread-safe operations

**Encrypted Request Flow:**
```json
{
  "nonce": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": 1704067200,
  "encryptedKey": "...",
  "encryptedData": "...",
  "signature": "..."
}
```

---

## 5. Rate Limiting

### SlowAPI Configuration

**Limits:**
- `/api/tts/generate` - 30 requests/minute
- `/api/tts/generate-mentor-content` - 10 requests/minute
- Default - 100 requests/minute

**Implementation:**
```python
@router.post("/api/tts/generate")
@limiter.limit("30/minute")
async def generate_speech(...):
    ...
```

**Response Headers:**
- `X-RateLimit-Limit` - Max requests allowed
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Time until reset

---

## 6. Data Validation & Sanitization

### Input Validation

**Pydantic Models:**
- All API requests validated with Pydantic schemas
- Type checking and bounds validation
- Automatic sanitization

**Example:**
```python
class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    speed: float = Field(default=1.0, ge=0.25, le=4.0)
```

### SQL Injection Prevention

- **SQLAlchemy ORM** - Parameterized queries
- **No raw SQL** - All queries through ORM
- **Input validation** - Strict type checking

---

## 7. Security Headers

### FastAPI Middleware

```python
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

**Headers Added:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (production only)

---

## 8. Logging & Monitoring

### Security Event Logging

**Logged Events:**
- Authentication failures
- Encryption/decryption errors
- Replay attack attempts
- Rate limit violations
- Invalid signatures

**Log Levels:**
- `ERROR` - Security violations
- `WARNING` - Suspicious activity
- `INFO` - Normal operations
- `DEBUG` - Detailed diagnostics

**Log Sanitization:**
- **Never log:** Passwords, encryption keys, tokens
- **Sanitize:** User content, PII
- **Truncate:** Long payloads

---

## 9. Environment Variables

### Required Production Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET_KEY=<strong-random-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# Encryption at Rest
FIELD_ENCRYPTION_KEY=<fernet-key>

# Request/Response Encryption (Optional)
RSA_PRIVATE_KEY_PEM=<rsa-private-key>

# AI Services
DEEPSEEK_API_KEY=<deepseek-key>
GOOGLE_CLOUD_TTS_API_KEY=<google-key>

# Environment
ENVIRONMENT=production
```

### Key Generation

```bash
# JWT Secret (64 bytes)
openssl rand -hex 64

# Field Encryption Key (Fernet)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# RSA Key Pair (2048-bit)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

---

## 10. Deployment Checklist

### Pre-Production Security Review

- [ ] All encryption keys set in environment
- [ ] TLS/HTTPS enabled and enforced
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Logging and monitoring active
- [ ] Database access restricted
- [ ] Secrets stored in secret manager
- [ ] No credentials in code/config
- [ ] CORS properly configured
- [ ] Input validation on all endpoints

### Production Environment

- [ ] Set `ENVIRONMENT=production`
- [ ] Enable `ENCRYPTION_REQUIRED=True` (after migration)
- [ ] Configure firewall rules
- [ ] Enable automated backups
- [ ] Set up intrusion detection
- [ ] Configure log aggregation
- [ ] Enable audit trails
- [ ] Test disaster recovery

---

## 11. Incident Response

### Security Incident Procedure

1. **Detect** - Monitor logs and alerts
2. **Contain** - Isolate affected systems
3. **Investigate** - Analyze logs and data
4. **Remediate** - Fix vulnerabilities
5. **Document** - Record incident details
6. **Review** - Post-mortem analysis

### Emergency Contacts

- Security Team: security@playstudy.com
- On-Call Engineer: oncall@playstudy.com

---

## 12. Compliance

### Data Protection

- **GDPR** - User data protection and privacy
- **CCPA** - California consumer privacy
- **COPPA** - Children's online privacy (if applicable)

### Data Retention

- **User Data:** Retained until account deletion
- **Encrypted Data:** Same as source data
- **Logs:** 90 days retention
- **Audit Trails:** 1 year retention

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE/SANS Top 25](https://www.sans.org/top25-software-errors/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
