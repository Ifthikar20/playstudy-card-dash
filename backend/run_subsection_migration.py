#!/usr/bin/env python3
"""
Database migration script to add subsection support to topics.
Run this with: python run_subsection_migration.py
"""
import sys
from sqlalchemy import create_engine, text
from app.config import settings

def run_migration():
    """Execute database migration for subsection support."""
    print("Connecting to database...")
    engine = create_engine(str(settings.DATABASE_URL))

    migration_sql = """
-- Add parent_topic_id and is_category columns to topics table
ALTER TABLE topics
ADD COLUMN IF NOT EXISTS parent_topic_id INTEGER REFERENCES topics(id) ON DELETE CASCADE;

ALTER TABLE topics
ADD COLUMN IF NOT EXISTS is_category BOOLEAN DEFAULT false;

-- Create index for parent_topic_id
CREATE INDEX IF NOT EXISTS ix_topics_parent_topic_id ON topics(parent_topic_id);

-- Update existing topics to be non-category topics (leaf nodes with questions)
UPDATE topics
SET is_category = false
WHERE is_category IS NULL;
"""

    try:
        with engine.connect() as conn:
            # Execute migration in a transaction
            print("Running migration...")
            conn.execute(text(migration_sql))
            conn.commit()
            print("✓ Migration completed successfully!")

            # Display table info
            print("\nVerifying schema...")
            result = conn.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'topics'
                AND column_name IN ('parent_topic_id', 'is_category')
                ORDER BY column_name;
            """))

            columns = [row[0] for row in result]
            if 'parent_topic_id' in columns and 'is_category' in columns:
                print(f"✓ Added columns: {', '.join(columns)}")
            else:
                print(f"✗ Some columns missing. Found: {', '.join(columns)}")

    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)

    print("\n✓ Database migration complete!")
    print("Topics now support hierarchical structure with categories and subcategories!")

if __name__ == "__main__":
    run_migration()
