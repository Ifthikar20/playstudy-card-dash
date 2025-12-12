#!/bin/bash

# Playstudy API Backend Quick Start Script
# This script sets up the Python backend with all required dependencies

set -e

echo "🚀 Playstudy API Backend Quick Start"
echo "===================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✓ Python found: $(python3 --version)"
echo ""

# Create backend directory
echo "📁 Creating backend directory structure..."
mkdir -p backend/app/{models,schemas,api,core,services}
mkdir -p backend/tests
mkdir -p backend/alembic/versions

# Create __init__.py files
touch backend/app/__init__.py
touch backend/app/models/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/api/__init__.py
touch backend/app/core/__init__.py
touch backend/app/services/__init__.py
touch backend/tests/__init__.py

echo "✓ Directory structure created"
echo ""

# Create virtual environment
echo "🐍 Creating virtual environment..."
cd backend
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

echo "✓ Virtual environment created and activated"
echo ""

# Create requirements.txt
echo "📦 Creating requirements.txt..."
cat > requirements.txt << 'EOF'
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
pytest==7.4.3
httpx==0.25.2
EOF

echo "✓ requirements.txt created"
echo ""

# Install dependencies
echo "📥 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✓ Dependencies installed"
echo ""

# Create .env file
echo "⚙️  Creating .env configuration..."
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/playstudy_db
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis Cache
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=300

# Security
SECRET_KEY=change-this-super-secret-key-in-production-abc123xyz789
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
DEBUG=true
ENVIRONMENT=development
EOF

echo "✓ .env file created (remember to update SECRET_KEY in production!)"
echo ""

# Create README
echo "📝 Creating backend README..."
cat > README.md << 'EOF'
# Playstudy API Backend

Python FastAPI backend for Playstudy.ai with consolidated API architecture.

## Quick Start

```bash
# Activate virtual environment
source venv/bin/activate

# Run development server
uvicorn app.main:app --reload --port 3001
```

## Prerequisites

- PostgreSQL 12+ running on localhost:5432
- Redis running on localhost:6379
- Python 3.8+

## Database Setup

```bash
# Create database
createdb playstudy_db

# Run migrations
alembic upgrade head
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:3001/api/docs
- ReDoc: http://localhost:3001/api/redoc

## Testing

```bash
pytest tests/
```

## See Also

- [Full Implementation Guide](../BACKEND_IMPLEMENTATION.md)
- [API Integration Docs](../API_INTEGRATION.md)
EOF

echo "✓ README created"
echo ""

echo "✅ Backend setup complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Install and start PostgreSQL: createdb playstudy_db"
echo "   2. Install and start Redis: redis-server"
echo "   3. Copy files from BACKEND_IMPLEMENTATION.md to respective locations"
echo "   4. Update .env with your database credentials"
echo "   5. Run migrations: alembic upgrade head"
echo "   6. Start the server: uvicorn app.main:app --reload --port 3001"
echo ""
echo "📚 Documentation:"
echo "   - Backend Implementation: ../BACKEND_IMPLEMENTATION.md"
echo "   - API Integration: ../API_INTEGRATION.md"
echo ""
echo "🎉 Happy coding!"
