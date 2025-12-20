#!/usr/bin/env python3
"""
Run database migration to add folders table and folder_id column
"""
from app.database import engine
from sqlalchemy import text

def run_migration():
    """Apply the folders migration"""
    print("🔄 Running folders migration...")

    with engine.connect() as conn:
        try:
            # Create folders table
            print("  Creating folders table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS folders (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    color VARCHAR DEFAULT '#3B82F6',
                    icon VARCHAR DEFAULT '📁',
                    is_archived BOOLEAN DEFAULT false,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
                )
            """))

            # Create indexes for folders
            print("  Creating indexes for folders table...")
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_folders_id ON folders(id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_folders_user_id ON folders(user_id)"))

            # Add folder_id column to study_sessions
            print("  Adding folder_id column to study_sessions...")
            conn.execute(text("""
                ALTER TABLE study_sessions
                ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL
            """))

            # Create index for folder_id
            print("  Creating index for folder_id...")
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_study_sessions_folder_id ON study_sessions(folder_id)"))

            conn.commit()
            print("✅ Migration applied successfully!")
            print("   - Created folders table")
            print("   - Added folder_id column to study_sessions table")

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    run_migration()
