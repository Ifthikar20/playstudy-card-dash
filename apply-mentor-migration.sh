#!/bin/bash
# Apply mentor_narrative column migration

echo "🔄 Applying mentor_narrative migration..."

# Use Python to run the migration (handles SQLAlchemy URLs)
cd backend || exit 1

if [ ! -f .env ]; then
    echo "❌ .env file not found in backend/"
    exit 1
fi

echo "✅ Running migration via Python..."

python3 << 'PYTHON_EOF'
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from app.database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        # Add the mentor_narrative column
        conn.execute(text(
            "ALTER TABLE topics ADD COLUMN IF NOT EXISTS mentor_narrative TEXT"
        ))
        conn.commit()
        print("✅ Migration applied successfully!")
        print("📝 Added mentor_narrative column to topics table")
except Exception as e:
    print(f"❌ Migration failed: {e}")
    print("\n💡 Make sure:")
    print("   1. PostgreSQL is running")
    print("   2. Database exists (run: createdb playstudy_db)")
    print("   3. DATABASE_URL in .env is correct")
    sys.exit(1)
PYTHON_EOF

if [ $? -eq 0 ]; then
    echo "🎉 Migration complete!"
else
    echo ""
    echo "📋 Alternative: Run migration manually in psql:"
    echo "   createdb playstudy_db  # if database doesn't exist"
    echo "   psql playstudy_db -c \"ALTER TABLE topics ADD COLUMN IF NOT EXISTS mentor_narrative TEXT;\""
fi
