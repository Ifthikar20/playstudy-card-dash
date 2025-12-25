#!/bin/bash

# Script to create a separate backend repository
# Run this from the root of playstudy-card-dash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

BACKEND_DIR="playstudy-backend"
CURRENT_DIR=$(pwd)

print_info "Creating separate backend repository..."

# Create new directory for backend repo
cd ..
mkdir -p $BACKEND_DIR
cd $BACKEND_DIR

print_info "Initializing git repository..."
git init

# Copy backend files
print_info "Copying backend application files..."
cp -r "$CURRENT_DIR/backend/"* .

# Copy deployment files
print_info "Copying deployment configurations..."
mkdir -p deploy
cp -r "$CURRENT_DIR/deploy/"* deploy/

# Copy documentation
print_info "Copying documentation..."
cp "$CURRENT_DIR/AWS_ECS_DEPLOYMENT_GUIDE.md" .
cp "$CURRENT_DIR/COST_ANALYSIS.md" .
cp "$CURRENT_DIR/PROGRESS_BATCHING.md" .

# Create backend-specific .gitignore
print_info "Creating .gitignore..."
cat > .gitignore <<'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# Environment files
.env
.env.*
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Testing
.pytest_cache/
.coverage
htmlcov/
.tox/
*.cover
.hypothesis/

# Database
*.db
*.sqlite
*.sqlite3
*.dump

# Logs
*.log
logs/

# Alembic
alembic/versions/*.pyc

# MyPy
.mypy_cache/
.dmypy.json
dmypy.json

# Pyre
.pyre/

# Docker
.dockerignore

# OS
Thumbs.db

# Secrets
credentials.json
secrets.json
*.pem
*.key
*.crt
*.cer
EOF

# Create backend-specific README
print_info "Creating README.md..."
cat > README.md <<'EOF'
# PlayStudy Backend API

FastAPI-based backend for the PlayStudy Card Dashboard application.

## Features

- ✅ FastAPI with async support
- ✅ PostgreSQL with SQLAlchemy ORM
- ✅ Redis caching
- ✅ JWT authentication
- ✅ AI integrations (Anthropic Claude, DeepSeek)
- ✅ Text-to-Speech (OpenAI, Google Cloud)
- ✅ Rate limiting
- ✅ Field-level encryption
- ✅ Comprehensive API documentation

## Quick Start

### Local Development

1. **Install dependencies:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Run database migrations:**
```bash
alembic upgrade head
```

4. **Start the server:**
```bash
uvicorn app.main:app --reload --port 8000
```

5. **Access API documentation:**
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

### Docker Development

```bash
docker build -t playstudy-backend .
docker run -p 8000:8000 --env-file .env playstudy-backend
```

## AWS Deployment

See [AWS_ECS_DEPLOYMENT_GUIDE.md](./AWS_ECS_DEPLOYMENT_GUIDE.md) for complete deployment instructions.

**Quick deploy:**
```bash
cd deploy
./setup-infrastructure.sh  # One-time setup
./deploy.sh                 # Deploy application
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Study Sessions
- `GET /api/app-data` - Get all app data
- `POST /api/study-sessions/create-with-ai` - Create session with AI
- `GET /api/study-sessions/{id}` - Get session details
- `PATCH /api/study-sessions/{id}/topics/{topic_id}/progress` - Update progress

### Text-to-Speech
- `POST /api/tts/generate` - Generate speech
- `GET /api/tts/providers` - Get available providers

See full API documentation at `/api/docs` when running.

## Architecture

```
FastAPI Application
    ├── PostgreSQL (RDS)
    ├── Redis (ElastiCache)
    ├── Anthropic Claude API
    ├── OpenAI TTS API
    └── Google Cloud TTS API
```

## Configuration

Key environment variables:

```bash
# Database
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379/0

# Security
SECRET_KEY=your-secret-key
FIELD_ENCRYPTION_KEY=your-encryption-key

# API Keys
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
GOOGLE_CLOUD_API_KEY=your-key
RECAPTCHA_SECRET_KEY=your-key
```

## Database Schema

See `app/models/` for complete schema:
- `User` - User accounts and profiles
- `StudySession` - Study sessions
- `Topic` - Topics and subtopics
- `Question` - Questions and answers
- `Folder` - Folder organization
- `Game` - Educational games

## Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app tests/
```

## Performance

- **Smart batching**: 90% reduction in API calls
- **Query optimization**: 5-6 queries per request (was 30+)
- **Redis caching**: 80% database load reduction
- **Rate limiting**: Prevents abuse

See [COST_ANALYSIS.md](./COST_ANALYSIS.md) for detailed performance metrics.

## Cost

Estimated monthly cost for 10,000 users: **$485-715**

See [COST_ANALYSIS.md](./COST_ANALYSIS.md) for breakdown.

## Documentation

- [AWS Deployment Guide](./AWS_ECS_DEPLOYMENT_GUIDE.md)
- [Cost Analysis](./COST_ANALYSIS.md)
- [Progress Batching](./PROGRESS_BATCHING.md)

## Tech Stack

- **Framework**: FastAPI 0.109+
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **ORM**: SQLAlchemy 2.0+
- **Authentication**: JWT (python-jose)
- **Deployment**: AWS ECS Fargate

## License

[Your License]

## Support

For issues and questions, see the main repository.
EOF

# Create docker-compose for backend local testing
print_info "Creating docker-compose.yml..."
cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: playstudy_db
      POSTGRES_USER: playstudy_user
      POSTGRES_PASSWORD: dev_password_change_in_production
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U playstudy_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+psycopg://playstudy_user:dev_password_change_in_production@postgres:5432/playstudy_db
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: dev-secret-key-change-in-production
      FIELD_ENCRYPTION_KEY: dev-encryption-key-change-in-production
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      DEEPSEEK_API_KEY: ${DEEPSEEK_API_KEY:-}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      GOOGLE_CLOUD_API_KEY: ${GOOGLE_CLOUD_API_KEY:-}
      RECAPTCHA_SECRET_KEY: ${RECAPTCHA_SECRET_KEY:-}
      ENVIRONMENT: development
      DEBUG: "True"
      ALLOWED_ORIGINS: http://localhost:5173,http://localhost:3000
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
EOF

print_info "Creating initial commit..."
git add .
git commit -m "Initial commit: PlayStudy Backend API

- FastAPI backend with PostgreSQL and Redis
- AWS ECS deployment configuration
- Docker support for local development
- Comprehensive API documentation
- Smart batching for performance optimization
"

print_info "✅ Backend repository created successfully!"
echo ""
print_info "Next steps:"
echo "  1. Create a new repository on GitHub: playstudy-backend"
echo "  2. Add remote:"
echo "     cd $BACKEND_DIR"
echo "     git remote add origin https://github.com/YOUR_USERNAME/playstudy-backend.git"
echo "  3. Push to GitHub:"
echo "     git push -u origin main"
echo ""
print_info "Location: $(pwd)"
EOF
