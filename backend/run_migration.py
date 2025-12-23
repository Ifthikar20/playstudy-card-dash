#!/usr/bin/env python3
"""
Run database migration to add source_text and source_page columns to questions table
"""
from app.database import engine
from sqlalchemy import text

def run_migration():
    """Apply the source_text and source_page columns migration"""
    with engine.connect() as conn:
        # Start a transaction
        trans = conn.begin()
        try:
            # Add the source_text column
            print("Adding source_text column...")
            conn.execute(text(
                "ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_text TEXT"
            ))

            # Add the source_page column
            print("Adding source_page column...")
            conn.execute(text(
                "ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_page INTEGER"
            ))

            # Add comments for documentation
            print("Adding column comments...")
            conn.execute(text(
                "COMMENT ON COLUMN questions.source_text IS 'Snippet of source material this question is based on'"
            ))
            conn.execute(text(
                "COMMENT ON COLUMN questions.source_page IS 'Page number in source document (for PDFs)'"
            ))

            # Commit the transaction
            trans.commit()
            print("✅ Migration applied successfully: Added source_text and source_page columns to questions table")
        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise

if __name__ == "__main__":
    run_migration()
