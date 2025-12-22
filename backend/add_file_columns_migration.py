"""
Migration script to add file_content and file_type columns to study_sessions table
and page_number column to topics table.
"""
from app.database import engine
from app.config import settings
from sqlalchemy import text

def run_migration():
    """Add new columns to existing tables."""
    print("🔄 Running migration to add file storage columns...")

    # Detect database type
    is_postgres = not settings.DATABASE_URL.startswith("sqlite")
    db_type = "PostgreSQL" if is_postgres else "SQLite"
    print(f"   Database type: {db_type}")
    print(f"   Database URL: {settings.DATABASE_URL}")

    try:
        with engine.begin() as conn:
            # Check if columns already exist
            print("\n📋 Checking existing schema...")

            # Add file_content column to study_sessions
            try:
                print("  Adding file_content column to study_sessions...")
                conn.execute(text("ALTER TABLE study_sessions ADD COLUMN file_content TEXT"))
                print("  ✅ file_content column added")
            except Exception as e:
                if "already exists" in str(e) or "duplicate column" in str(e).lower():
                    print("  ℹ️  file_content column already exists, skipping")
                else:
                    raise

            # Add file_type column to study_sessions
            try:
                print("  Adding file_type column to study_sessions...")
                conn.execute(text("ALTER TABLE study_sessions ADD COLUMN file_type VARCHAR"))
                print("  ✅ file_type column added")
            except Exception as e:
                if "already exists" in str(e) or "duplicate column" in str(e).lower():
                    print("  ℹ️  file_type column already exists, skipping")
                else:
                    raise

            # Add page_number column to topics
            try:
                print("  Adding page_number column to topics...")
                conn.execute(text("ALTER TABLE topics ADD COLUMN page_number INTEGER"))
                print("  ✅ page_number column added")
            except Exception as e:
                if "already exists" in str(e) or "duplicate column" in str(e).lower():
                    print("  ℹ️  page_number column already exists, skipping")
                else:
                    raise

            print("\n✅ Migration completed successfully!")
            print("\n📋 New columns added:")
            print("   - study_sessions.file_content (TEXT): Original uploaded file (base64)")
            print("   - study_sessions.file_type (VARCHAR): File type (pdf, pptx, docx, txt)")
            print("   - topics.page_number (INTEGER): Page/slide number in original document")

        return True

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    if success:
        print("\n🎉 Migration complete! You can now upload documents and they will be stored for Speed Run mode.")
    else:
        print("\n❌ Migration failed. Check the error above.")
