#!/usr/bin/env python3
"""
Run database migration to add mentor_narrative column to topics table
"""
from app.database import engine
from sqlalchemy import text

def run_migration():
    """Apply the mentor_narrative column migration"""
    with engine.connect() as conn:
        # Add the mentor_narrative column
        conn.execute(text(
            "ALTER TABLE topics ADD COLUMN IF NOT EXISTS mentor_narrative TEXT"
        ))
        conn.commit()
        print("✅ Migration applied successfully: Added mentor_narrative column to topics table")

if __name__ == "__main__":
    run_migration()
