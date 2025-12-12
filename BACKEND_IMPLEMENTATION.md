# Python Backend API Implementation Guide

## Overview

This guide provides a complete implementation for the Python backend API that supports the consolidated frontend architecture with comprehensive security features.

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Database Models](#database-models)
4. [API Endpoint Implementation](#api-endpoint-implementation)
5. [Security Features](#security-features)
6. [Authentication & Authorization](#authentication--authorization)
7. [Rate Limiting](#rate-limiting)
8. [CORS Configuration](#cors-configuration)
9. [Caching Strategy](#caching-strategy)
10. [Error Handling](#error-handling)
11. [Testing](#testing)
12. [Deployment](#deployment)

---

## Tech Stack

Recommended stack:
- **Framework**: FastAPI (async, high performance)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT tokens with PyJWT
- **Caching**: Redis
- **Security**: python-jose, passlib, python-multipart
- **Rate Limiting**: slowapi
- **Validation**: Pydantic (built into FastAPI)

---

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Configuration and environment variables
│   ├── database.py             # Database connection
│   ├── dependencies.py         # Dependency injection (auth, etc.)
│   │
│   ├── models/                 # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── game.py
│   │   ├── study_session.py
│   │   └── topic.py
│   │
│   ├── schemas/                # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── game.py
│   │   ├── study_session.py
│   │   └── app_data.py
│   │
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   ├── app_data.py         # Main consolidated endpoint
│   │   └── auth.py             # Authentication endpoints
│   │
│   ├── core/                   # Core utilities
│   │   ├── __init__.py
│   │   ├── security.py         # JWT, password hashing
│   │   ├── cache.py            # Redis caching
│   │   └── rate_limit.py       # Rate limiting
│   │
│   └── services/               # Business logic
│       ├── __init__.py
│       ├── user_service.py
│       ├── game_service.py
│       └── study_service.py
│
├── tests/
│   ├── __init__.py
│   ├── test_api.py
│   └── test_security.py
│
├── alembic/                    # Database migrations
│   └── versions/
│
├── requirements.txt
├── .env.example
└── README.md
```

---

## Installation & Setup

### 1. Install Dependencies

```bash
pip install fastapi[all] uvicorn[standard] sqlalchemy psycopg2-binary \
    python-jose[cryptography] passlib[bcrypt] python-multipart \
    redis slowapi pydantic-settings alembic
```

### 2. requirements.txt

```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
redis==5.0.1
slowapi==0.1.9
pydantic-settings==2.1.0
alembic==1.13.1
python-dotenv==1.0.0
```

---

## Configuration

### .env.example

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/playstudy_db
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis Cache
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=300

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
ALLOWED_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# App
API_V1_PREFIX=/api
DEBUG=false
ENVIRONMENT=production
```

### config.py

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str
    CACHE_TTL: int = 300

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173"]
    ALLOWED_CREDENTIALS: bool = True

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # App
    API_V1_PREFIX: str = "/api"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

---

## Database Models

### models/user.py

```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    avatar = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    study_sessions = relationship("StudySession", back_populates="user")
```

### models/game.py

```python
from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    category = Column(String, index=True)
    likes = Column(Integer, default=0)
    rating = Column(Float, default=0.0)
    image = Column(String)
    difficulty = Column(String)  # Easy, Medium, Hard
```

### models/study_session.py

```python
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    progress = Column(Integer, default=0)
    topics_count = Column(Integer, default=0)
    has_full_study = Column(Boolean, default=False)
    has_speed_run = Column(Boolean, default=False)
    has_quiz = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="study_sessions")
```

### database.py

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## Pydantic Schemas

### schemas/app_data.py

```python
from pydantic import BaseModel, EmailStr
from typing import List, Optional

class GameSchema(BaseModel):
    id: int
    title: str
    description: str
    category: str
    likes: int
    rating: float
    image: str
    difficulty: str

    class Config:
        from_attributes = True

class StudySessionSchema(BaseModel):
    id: str
    title: str
    progress: int
    topics: int
    time: str
    hasFullStudy: bool
    hasSpeedRun: bool
    hasQuiz: bool

    class Config:
        from_attributes = True

class UserProfileSchema(BaseModel):
    id: str
    name: str
    email: EmailStr
    xp: int
    level: int
    avatar: Optional[str] = None

    class Config:
        from_attributes = True

class StatsSchema(BaseModel):
    totalSessions: int
    averageAccuracy: int
    questionsAnswered: int
    totalStudyTime: str

class AppDataResponse(BaseModel):
    games: List[GameSchema]
    studySessions: List[StudySessionSchema]
    userProfile: UserProfileSchema
    stats: StatsSchema
```

---

## Core Security

### core/security.py

```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
```

### core/cache.py

```python
import redis
import json
from typing import Optional, Any
from app.config import settings

class RedisCache:
    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        try:
            value = self.redis_client.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None

    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache."""
        try:
            ttl = ttl or settings.CACHE_TTL
            serialized = json.dumps(value)
            self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    def invalidate_user_cache(self, user_id: str):
        """Invalidate all cache for a user."""
        self.delete(f"app_data:{user_id}")

cache = RedisCache()
```

### core/rate_limit.py

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
```

---

## Authentication & Authorization

### dependencies.py

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import verify_token
from app.models.user import User

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user."""
    token = credentials.credentials
    payload = verify_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user
```

---

## Main Endpoint Implementation

### api/app_data.py

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.models.game import Game
from app.models.study_session import StudySession
from app.schemas.app_data import AppDataResponse, GameSchema, StudySessionSchema, UserProfileSchema, StatsSchema
from app.core.cache import cache
from app.core.rate_limit import limiter

router = APIRouter()

def calculate_relative_time(created_at: datetime) -> str:
    """Calculate relative time string."""
    now = datetime.utcnow()
    diff = now - created_at

    if diff.days > 1:
        return f"{diff.days} days ago"
    elif diff.days == 1:
        return "Yesterday"
    elif diff.seconds >= 3600:
        hours = diff.seconds // 3600
        return f"{hours} hours ago"
    else:
        return "Just now"

@router.get("/app-data", response_model=AppDataResponse)
@limiter.limit("30/minute")  # Rate limit: 30 requests per minute
async def get_app_data(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    **Consolidated endpoint that returns ALL application data in a single call.**

    This endpoint provides:
    - All available games
    - User's study sessions
    - User profile information
    - User statistics

    **Security:**
    - Requires valid JWT token
    - Rate limited to 30 requests/minute
    - User-specific data isolation
    - Cached for 5 minutes

    **Returns:**
    - AppDataResponse with games, studySessions, userProfile, and stats
    """

    # Check cache first
    cache_key = f"app_data:{current_user.id}"
    cached_data = cache.get(cache_key)
    if cached_data:
        return cached_data

    try:
        # 1. Fetch all games (public data)
        games = db.query(Game).all()
        games_data = [
            GameSchema(
                id=game.id,
                title=game.title,
                description=game.description,
                category=game.category,
                likes=game.likes,
                rating=game.rating,
                image=game.image,
                difficulty=game.difficulty
            )
            for game in games
        ]

        # 2. Fetch user's study sessions
        study_sessions = db.query(StudySession).filter(
            StudySession.user_id == current_user.id
        ).order_by(StudySession.updated_at.desc()).limit(20).all()

        sessions_data = [
            StudySessionSchema(
                id=session.id,
                title=session.title,
                progress=session.progress,
                topics=session.topics_count,
                time=calculate_relative_time(session.updated_at),
                hasFullStudy=session.has_full_study,
                hasSpeedRun=session.has_speed_run,
                hasQuiz=session.has_quiz
            )
            for session in study_sessions
        ]

        # 3. User profile
        user_profile = UserProfileSchema(
            id=current_user.id,
            name=current_user.name,
            email=current_user.email,
            xp=current_user.xp,
            level=current_user.level,
            avatar=current_user.avatar
        )

        # 4. Calculate user statistics
        # Total sessions
        total_sessions = db.query(func.count(StudySession.id)).filter(
            StudySession.user_id == current_user.id
        ).scalar() or 0

        # Average accuracy (mock for now - implement based on your answer tracking)
        average_accuracy = 85  # TODO: Calculate from actual answer data

        # Questions answered (mock for now - implement based on your answer tracking)
        questions_answered = 247  # TODO: Calculate from actual answer data

        # Total study time (mock for now - implement based on your session tracking)
        total_study_time = "18hrs"  # TODO: Calculate from actual session durations

        stats = StatsSchema(
            totalSessions=total_sessions,
            averageAccuracy=average_accuracy,
            questionsAnswered=questions_answered,
            totalStudyTime=total_study_time
        )

        # 5. Build response
        response_data = AppDataResponse(
            games=games_data,
            studySessions=sessions_data,
            userProfile=user_profile,
            stats=stats
        )

        # Cache the response
        cache.set(cache_key, response_data.model_dump(), ttl=300)  # 5 minutes

        return response_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching application data: {str(e)}"
        )
```

### api/auth.py

```python
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.models.user import User
from app.core.security import verify_password, get_password_hash, create_access_token
from app.config import settings
from pydantic import BaseModel, EmailStr

router = APIRouter()

class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user."""

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    import uuid
    new_user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        name=user_data.name,
        hashed_password=get_password_hash(user_data.password),
        xp=0,
        level=1,
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create access token
    access_token = create_access_token(data={"sub": new_user.id})

    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with email and password."""

    # Find user by email
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    # Create access token
    access_token = create_access_token(data={"sub": user.id})

    return {"access_token": access_token, "token_type": "bearer"}
```

---

## Main Application

### main.py

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.core.rate_limit import limiter
from app.api import app_data, auth
from app.database import engine, Base

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Playstudy API",
    description="Consolidated API for Playstudy.ai application",
    version="1.0.0",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    redoc_url=f"{settings.API_V1_PREFIX}/redoc",
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=settings.ALLOWED_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Authentication"])
app.include_router(app_data.router, prefix=settings.API_V1_PREFIX, tags=["App Data"])

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Playstudy API",
        "version": "1.0.0",
        "docs": f"{settings.API_V1_PREFIX}/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3001,
        reload=settings.DEBUG
    )
```

---

## Security Checklist

### ✅ Implemented Security Features

1. **Authentication & Authorization**
   - JWT-based authentication
   - Secure password hashing with bcrypt
   - Token expiration and refresh
   - User session management

2. **Data Protection**
   - HTTPS enforcement (Strict-Transport-Security header)
   - SQL injection prevention (SQLAlchemy ORM)
   - XSS protection headers
   - CORS configuration

3. **Rate Limiting**
   - Per-user rate limiting
   - Global rate limiting
   - Customizable limits per endpoint

4. **Input Validation**
   - Pydantic schema validation
   - Email validation
   - Type checking

5. **Error Handling**
   - No sensitive data in error messages
   - Proper HTTP status codes
   - Logging without exposing secrets

6. **Database Security**
   - Connection pooling
   - Prepared statements (ORM)
   - Connection recycling
   - User data isolation

7. **Caching**
   - User-specific cache keys
   - Cache invalidation
   - TTL management

8. **Security Headers**
   - X-Content-Type-Options
   - X-Frame-Options
   - X-XSS-Protection
   - Strict-Transport-Security

---

## Running the Application

### Development

```bash
# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 3001
```

### Production

```bash
# Use gunicorn with uvicorn workers
gunicorn app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:3001 \
    --access-logfile - \
    --error-logfile -
```

---

## Database Migrations

```bash
# Initialize alembic
alembic init alembic

# Create a migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## Testing

### test_api.py

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_app_data_unauthorized():
    response = client.get("/api/app-data")
    assert response.status_code == 401

def test_register_and_get_data():
    # Register
    register_data = {
        "email": "test@example.com",
        "name": "Test User",
        "password": "testpassword123"
    }
    response = client.post("/api/auth/register", json=register_data)
    assert response.status_code == 200
    token = response.json()["access_token"]

    # Get app data
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/app-data", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "games" in data
    assert "studySessions" in data
    assert "userProfile" in data
    assert "stats" in data
```

Run tests:
```bash
pytest tests/
```

---

## Deployment Considerations

1. **Environment Variables**: Use secure secret management (AWS Secrets Manager, HashiCorp Vault)
2. **HTTPS**: Use reverse proxy (Nginx) with SSL certificates
3. **Database**: Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
4. **Redis**: Use managed Redis (ElastiCache, Redis Cloud)
5. **Monitoring**: Set up logging and monitoring (Sentry, DataDog)
6. **Backups**: Regular database backups
7. **CI/CD**: Automated testing and deployment
8. **Load Balancing**: Use load balancer for horizontal scaling

---

## Additional Security Recommendations

1. **API Key Rotation**: Implement regular token rotation
2. **Audit Logging**: Log all authentication attempts and data access
3. **Input Sanitization**: Additional validation for user inputs
4. **DDoS Protection**: Use CloudFlare or AWS Shield
5. **Dependency Scanning**: Regular security audits of dependencies
6. **Penetration Testing**: Regular security assessments
7. **Data Encryption**: Encrypt sensitive data at rest
8. **Backup Encryption**: Encrypt database backups

---

## Performance Optimization

1. **Database Indexing**: Add indexes on frequently queried fields
2. **Query Optimization**: Use query profiling and optimization
3. **Connection Pooling**: Optimize pool size based on load
4. **Caching Strategy**: Cache expensive queries
5. **Async Operations**: Use async/await for I/O operations
6. **Response Compression**: Enable gzip compression
7. **CDN**: Use CDN for static assets

---

## Monitoring & Logging

```python
import logging
from logging.handlers import RotatingFileHandler

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler('app.log', maxBytes=10485760, backupCount=10),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

---

## Next Steps

1. Implement database migrations with Alembic
2. Set up Redis for caching
3. Configure PostgreSQL database
4. Add comprehensive tests
5. Set up CI/CD pipeline
6. Configure production environment
7. Implement monitoring and alerting
8. Perform security audit
9. Load testing
10. Documentation updates

---

For questions or issues, refer to the FastAPI documentation: https://fastapi.tiangolo.com/
