#!/bin/bash
# Apply mentor_narrative column migration

echo "🔄 Applying mentor_narrative migration..."

# Check if psql is available
if command -v psql &> /dev/null; then
    # Get DATABASE_URL from .env
    if [ -f backend/.env ]; then
        export $(grep -v '^#' backend/.env | grep DATABASE_URL | xargs)
        echo "✅ Found DATABASE_URL in .env"
        
        # Apply migration
        psql "$DATABASE_URL" -c "ALTER TABLE topics ADD COLUMN IF NOT EXISTS mentor_narrative TEXT;" 2>&1
        
        if [ $? -eq 0 ]; then
            echo "✅ Migration applied successfully!"
            echo "📝 Added mentor_narrative column to topics table"
        else
            echo "❌ Migration failed. Please check your database connection."
            exit 1
        fi
    else
        echo "❌ .env file not found in backend/"
        exit 1
    fi
else
    echo "⚠️  psql not found. Please install PostgreSQL client or run manually:"
    echo ""
    echo "psql \$DATABASE_URL -c \"ALTER TABLE topics ADD COLUMN IF NOT EXISTS mentor_narrative TEXT;\""
    exit 1
fi
