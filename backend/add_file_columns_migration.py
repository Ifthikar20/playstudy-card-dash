"""
Migration script to add file_content and file_type columns to study_sessions table
and page_number column to topics table.
"""
from app.database import engine
from app.config import settings
from sqlalchemy import text, inspect

def run_migration():
    """Add new columns to existing tables."""
    print("🔄 Running migration to add file storage columns...")

    # Detect database type
    is_postgres = not settings.DATABASE_URL.startswith("sqlite")
    db_type = "PostgreSQL" if is_postgres else "SQLite"
    print(f"   Database type: {db_type}")
    print(f"   Database URL: {settings.DATABASE_URL}")

    try:
        # First, check which columns already exist
        inspector = inspect(engine)
        existing_study_columns = [col['name'] for col in inspector.get_columns('study_sessions')]
        existing_topic_columns = [col['name'] for col in inspector.get_columns('topics')]

        print("\n📋 Checking existing schema...")
        print(f"   Study sessions columns: {', '.join(existing_study_columns)}")
        print(f"   Topics columns: {', '.join(existing_topic_columns)}")

        # Add columns one by one in separate transactions
        columns_to_add = []

        # Check file_content
        if 'file_content' not in existing_study_columns:
            columns_to_add.append(('study_sessions', 'file_content', 'TEXT', 'Original uploaded file (base64)'))
        else:
            print("\n  ℹ️  file_content column already exists in study_sessions")

        # Check file_type
        if 'file_type' not in existing_study_columns:
            columns_to_add.append(('study_sessions', 'file_type', 'VARCHAR', 'File type (pdf, pptx, docx, txt)'))
        else:
            print("  ℹ️  file_type column already exists in study_sessions")

        # Check page_number
        if 'page_number' not in existing_topic_columns:
            columns_to_add.append(('topics', 'page_number', 'INTEGER', 'Page/slide number in original document'))
        else:
            print("  ℹ️  page_number column already exists in topics")

        # Add missing columns
        if not columns_to_add:
            print("\n✅ All columns already exist! No migration needed.")
            return True

        print(f"\n🔨 Adding {len(columns_to_add)} missing column(s)...\n")

        for table, column, col_type, description in columns_to_add:
            try:
                with engine.begin() as conn:
                    sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
                    print(f"  Adding {column} to {table}...")
                    conn.execute(text(sql))
                    print(f"  ✅ {column} column added successfully")
            except Exception as e:
                if "already exists" in str(e) or "duplicate column" in str(e).lower():
                    print(f"  ℹ️  {column} column already exists in {table}, skipping")
                else:
                    raise

        print("\n✅ Migration completed successfully!")
        print("\n📋 New columns added:")
        if 'file_content' in [c[1] for c in columns_to_add]:
            print("   - study_sessions.file_content (TEXT): Original uploaded file (base64)")
        if 'file_type' in [c[1] for c in columns_to_add]:
            print("   - study_sessions.file_type (VARCHAR): File type (pdf, pptx, docx, txt)")
        if 'page_number' in [c[1] for c in columns_to_add]:
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
