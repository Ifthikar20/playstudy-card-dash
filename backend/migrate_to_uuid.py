"""
Database migration script to convert study_sessions.id from Integer to UUID.

This script handles the migration for both PostgreSQL and SQLite databases.
It preserves relationships and generates new UUIDs for existing sessions.

IMPORTANT:
- Backup your database before running this script!
- This is a breaking change - old session IDs will not work
- Run this AFTER deploying the new code with UUID support

Usage:
    python migrate_to_uuid.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from app.config import settings
import uuid
from datetime import datetime


def get_database_type(engine):
    """Determine if database is PostgreSQL or SQLite."""
    return engine.dialect.name


def backup_database(engine, db_type):
    """Create a backup of critical tables."""
    print("📦 Creating backup of study_sessions table...")

    with engine.connect() as conn:
        # Create backup table
        if db_type == 'postgresql':
            conn.execute(text("""
                DROP TABLE IF EXISTS study_sessions_backup;
                CREATE TABLE study_sessions_backup AS
                SELECT * FROM study_sessions;
            """))
        else:  # SQLite
            conn.execute(text("""
                DROP TABLE IF EXISTS study_sessions_backup;
                CREATE TABLE study_sessions_backup AS
                SELECT * FROM study_sessions;
            """))
        conn.commit()

    print("✅ Backup created successfully")


def migrate_postgresql(engine):
    """Migrate PostgreSQL database to use UUID."""
    print("\n🔄 Starting PostgreSQL migration...")

    with engine.connect() as conn:
        # Step 1: Create a temporary mapping table to store old_id -> new_uuid
        print("1️⃣ Creating ID mapping table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS session_id_mapping (
                old_id INTEGER PRIMARY KEY,
                new_uuid UUID NOT NULL
            );
        """))
        conn.commit()

        # Step 2: Generate UUIDs for all existing sessions
        print("2️⃣ Generating UUIDs for existing sessions...")
        result = conn.execute(text("SELECT id FROM study_sessions"))
        session_ids = [row[0] for row in result]

        for old_id in session_ids:
            new_uuid = str(uuid.uuid4())
            conn.execute(
                text("INSERT INTO session_id_mapping (old_id, new_uuid) VALUES (:old_id, :new_uuid)"),
                {"old_id": old_id, "new_uuid": new_uuid}
            )
        conn.commit()
        print(f"   Generated {len(session_ids)} UUIDs")

        # Step 3: Add new UUID column to study_sessions
        print("3️⃣ Adding UUID column to study_sessions...")
        conn.execute(text("""
            ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS id_uuid UUID;
        """))
        conn.commit()

        # Step 4: Populate UUID column from mapping
        print("4️⃣ Populating UUID values...")
        conn.execute(text("""
            UPDATE study_sessions ss
            SET id_uuid = m.new_uuid
            FROM session_id_mapping m
            WHERE ss.id = m.old_id;
        """))
        conn.commit()

        # Step 5: Add new UUID column to topics table (foreign key)
        print("5️⃣ Updating topics table...")
        conn.execute(text("""
            ALTER TABLE topics ADD COLUMN IF NOT EXISTS study_session_id_uuid UUID;
        """))
        conn.commit()

        # Step 6: Populate topics UUID column from mapping
        conn.execute(text("""
            UPDATE topics t
            SET study_session_id_uuid = m.new_uuid
            FROM session_id_mapping m
            WHERE t.study_session_id = m.old_id;
        """))
        conn.commit()

        # Step 7: Drop old foreign key constraint and id column
        print("6️⃣ Dropping old constraints and columns...")

        # Get the foreign key constraint name
        result = conn.execute(text("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'topics'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%study_session%';
        """))
        fk_constraints = [row[0] for row in result]

        for fk in fk_constraints:
            conn.execute(text(f"ALTER TABLE topics DROP CONSTRAINT IF EXISTS {fk}"))

        conn.commit()

        # Step 8: Drop old columns
        conn.execute(text("""
            ALTER TABLE topics DROP COLUMN IF EXISTS study_session_id;
            ALTER TABLE study_sessions DROP COLUMN IF EXISTS id;
        """))
        conn.commit()

        # Step 9: Rename UUID columns to id
        print("7️⃣ Renaming UUID columns...")
        conn.execute(text("""
            ALTER TABLE study_sessions RENAME COLUMN id_uuid TO id;
            ALTER TABLE topics RENAME COLUMN study_session_id_uuid TO study_session_id;
        """))
        conn.commit()

        # Step 10: Add primary key and foreign key constraints
        print("8️⃣ Adding new constraints...")
        conn.execute(text("""
            ALTER TABLE study_sessions ADD PRIMARY KEY (id);
            ALTER TABLE topics ADD CONSTRAINT fk_topics_study_session
                FOREIGN KEY (study_session_id) REFERENCES study_sessions(id) ON DELETE CASCADE;
        """))
        conn.commit()

        # Step 11: Recreate indexes
        print("9️⃣ Recreating indexes...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_study_sessions_id ON study_sessions(id);
            CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_topics_study_session_id ON topics(study_session_id);
        """))
        conn.commit()

        # Step 12: Clean up mapping table
        print("🧹 Cleaning up...")
        conn.execute(text("DROP TABLE IF EXISTS session_id_mapping;"))
        conn.commit()

    print("✅ PostgreSQL migration completed successfully!")


def migrate_sqlite(engine):
    """Migrate SQLite database to use UUID (stored as TEXT)."""
    print("\n🔄 Starting SQLite migration...")

    with engine.connect() as conn:
        # SQLite doesn't support ALTER COLUMN, so we need to recreate tables

        # Step 1: Create mapping table
        print("1️⃣ Creating ID mapping table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS session_id_mapping (
                old_id INTEGER PRIMARY KEY,
                new_uuid TEXT NOT NULL
            );
        """))
        conn.commit()

        # Step 2: Generate UUIDs for existing sessions
        print("2️⃣ Generating UUIDs for existing sessions...")
        result = conn.execute(text("SELECT id FROM study_sessions"))
        session_ids = [row[0] for row in result]

        for old_id in session_ids:
            new_uuid = str(uuid.uuid4())
            conn.execute(
                text("INSERT INTO session_id_mapping (old_id, new_uuid) VALUES (:old_id, :new_uuid)"),
                {"old_id": old_id, "new_uuid": new_uuid}
            )
        conn.commit()
        print(f"   Generated {len(session_ids)} UUIDs")

        # Step 3: Create new study_sessions table with UUID
        print("3️⃣ Creating new study_sessions table with UUID...")
        conn.execute(text("""
            CREATE TABLE study_sessions_new (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                game_id INTEGER,
                title TEXT NOT NULL,
                topic TEXT NOT NULL,
                study_content TEXT,
                duration INTEGER DEFAULT 0 NOT NULL,
                progress INTEGER DEFAULT 0,
                topics_count INTEGER DEFAULT 0,
                xp_earned INTEGER DEFAULT 0,
                accuracy INTEGER,
                status TEXT DEFAULT 'in_progress',
                is_completed INTEGER DEFAULT 0,
                has_full_study INTEGER DEFAULT 0,
                has_speed_run INTEGER DEFAULT 0,
                has_quiz INTEGER DEFAULT 0,
                started_at TEXT,
                completed_at TEXT,
                created_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE SET NULL
            );
        """))
        conn.commit()

        # Step 4: Copy data with UUID mapping
        print("4️⃣ Copying data with new UUIDs...")
        conn.execute(text("""
            INSERT INTO study_sessions_new
            SELECT
                m.new_uuid,
                ss.user_id, ss.game_id, ss.title, ss.topic, ss.study_content,
                ss.duration, ss.progress, ss.topics_count, ss.xp_earned,
                ss.accuracy, ss.status, ss.is_completed, ss.has_full_study,
                ss.has_speed_run, ss.has_quiz, ss.started_at, ss.completed_at,
                ss.created_at
            FROM study_sessions ss
            JOIN session_id_mapping m ON ss.id = m.old_id;
        """))
        conn.commit()

        # Step 5: Update topics table
        print("5️⃣ Updating topics table...")

        # Check if topics table exists
        inspector = inspect(engine)
        if 'topics' in inspector.get_table_names():
            # Get topics schema
            result = conn.execute(text("PRAGMA table_info(topics)"))
            columns = [row[1] for row in result]

            # Create new topics table
            conn.execute(text("""
                CREATE TABLE topics_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    study_session_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    is_category INTEGER DEFAULT 0,
                    parent_topic_id INTEGER,
                    order_index INTEGER DEFAULT 0,
                    completed INTEGER DEFAULT 0,
                    score INTEGER,
                    current_question_index INTEGER DEFAULT 0,
                    created_at TEXT,
                    FOREIGN KEY (study_session_id) REFERENCES study_sessions (id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_topic_id) REFERENCES topics (id) ON DELETE CASCADE
                );
            """))
            conn.commit()

            # Copy topics data with UUID mapping
            conn.execute(text("""
                INSERT INTO topics_new
                SELECT
                    t.id,
                    m.new_uuid,
                    t.title, t.description, t.is_category, t.parent_topic_id,
                    t.order_index, t.completed, t.score, t.current_question_index,
                    t.created_at
                FROM topics t
                JOIN session_id_mapping m ON t.study_session_id = m.old_id;
            """))
            conn.commit()

            # Drop old topics table
            conn.execute(text("DROP TABLE topics"))
            conn.commit()

            # Rename new topics table
            conn.execute(text("ALTER TABLE topics_new RENAME TO topics"))
            conn.commit()

        # Step 6: Replace old study_sessions table
        print("6️⃣ Replacing old study_sessions table...")
        conn.execute(text("DROP TABLE study_sessions"))
        conn.commit()

        conn.execute(text("ALTER TABLE study_sessions_new RENAME TO study_sessions"))
        conn.commit()

        # Step 7: Recreate indexes
        print("7️⃣ Recreating indexes...")
        conn.execute(text("""
            CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
        """))
        if 'topics' in inspector.get_table_names():
            conn.execute(text("""
                CREATE INDEX idx_topics_study_session_id ON topics(study_session_id);
            """))
        conn.commit()

        # Step 8: Clean up mapping table
        print("🧹 Cleaning up...")
        conn.execute(text("DROP TABLE session_id_mapping"))
        conn.commit()

    print("✅ SQLite migration completed successfully!")


def verify_migration(engine):
    """Verify the migration was successful."""
    print("\n🔍 Verifying migration...")

    with engine.connect() as conn:
        # Check study_sessions table structure
        result = conn.execute(text("""
            SELECT id FROM study_sessions LIMIT 1
        """))
        row = result.fetchone()

        if row:
            session_id = str(row[0])
            # Try to parse as UUID
            try:
                uuid.UUID(session_id)
                print(f"✅ Session IDs are valid UUIDs (example: {session_id})")
            except ValueError:
                print(f"❌ Session IDs are not valid UUIDs (found: {session_id})")
                return False
        else:
            print("ℹ️  No sessions in database to verify")

        # Count sessions
        result = conn.execute(text("SELECT COUNT(*) FROM study_sessions"))
        count = result.fetchone()[0]
        print(f"✅ Found {count} study sessions in database")

    return True


def main():
    """Main migration function."""
    print("=" * 60)
    print("Study Session UUID Migration")
    print("=" * 60)
    print(f"\nTimestamp: {datetime.now()}")
    print(f"Database URL: {settings.DATABASE_URL}")

    # Create engine
    engine = create_engine(settings.DATABASE_URL)
    db_type = get_database_type(engine)

    print(f"Database type: {db_type}")

    # Confirm migration
    print("\n⚠️  WARNING: This migration will modify your database structure!")
    print("   - Old integer session IDs will be replaced with UUIDs")
    print("   - Old session URLs will no longer work")
    print("   - A backup will be created before migration")

    response = input("\nDo you want to continue? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("❌ Migration cancelled")
        return

    try:
        # Backup database
        backup_database(engine, db_type)

        # Run migration based on database type
        if db_type == 'postgresql':
            migrate_postgresql(engine)
        elif db_type == 'sqlite':
            migrate_sqlite(engine)
        else:
            print(f"❌ Unsupported database type: {db_type}")
            return

        # Verify migration
        if verify_migration(engine):
            print("\n" + "=" * 60)
            print("✅ Migration completed successfully!")
            print("=" * 60)
            print("\nNext steps:")
            print("1. Test your application with the new UUID-based sessions")
            print("2. If everything works, you can drop the backup table:")
            print("   DROP TABLE study_sessions_backup;")
            print("3. Clear browser localStorage cache or wait for TTL expiration")
        else:
            print("\n❌ Migration verification failed!")
            print("Please check the database and restore from backup if needed:")
            print("   DROP TABLE study_sessions;")
            print("   ALTER TABLE study_sessions_backup RENAME TO study_sessions;")

    except Exception as e:
        print(f"\n❌ Migration failed with error: {str(e)}")
        print("\nTo restore from backup:")
        print("   DROP TABLE study_sessions;")
        print("   ALTER TABLE study_sessions_backup RENAME TO study_sessions;")
        raise


if __name__ == "__main__":
    main()
