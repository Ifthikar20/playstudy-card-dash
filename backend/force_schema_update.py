"""
Force schema update by dropping and recreating all tables.
This script uses raw SQL to ensure tables are completely dropped.
Works with both PostgreSQL and SQLite.
"""
from app.database import engine
from app.models.user import User
from app.models.game import Game
from app.models.study_session import StudySession
from app.config import settings
from sqlalchemy import text

def force_schema_update():
    """Drop all tables and recreate them with the new schema."""
    print("🔄 Forcing schema update...")

    # Detect database type
    is_postgres = not settings.DATABASE_URL.startswith("sqlite")
    cascade = " CASCADE" if is_postgres else ""

    db_type = "PostgreSQL" if is_postgres else "SQLite"
    print(f"   Database type: {db_type}")
    print(f"   Database URL: {settings.DATABASE_URL}")

    try:
        with engine.begin() as conn:
            # Drop tables in reverse dependency order (with CASCADE for PostgreSQL)
            print("  Dropping study_sessions table...")
            conn.execute(text(f"DROP TABLE IF EXISTS study_sessions{cascade}"))

            print("  Dropping games table...")
            conn.execute(text(f"DROP TABLE IF EXISTS games{cascade}"))

            print("  Dropping users table...")
            conn.execute(text(f"DROP TABLE IF EXISTS users{cascade}"))

            print("✅ All tables dropped successfully")

        # Now recreate tables with new schema
        print("\n🔨 Creating tables with new schema...")
        from app.database import Base
        Base.metadata.create_all(bind=engine)

        print("✅ Tables created successfully with new schema!")
        print("\n📋 New schema includes:")
        print("   - users table: id, email, name, hashed_password, level, xp, created_at")
        print("   - games table: id, title, description, category, image, likes, rating, difficulty")
        print("   - study_sessions table: id, user_id, title, progress, topics_count, time_spent, has_full_study, has_speed_run, has_quiz, last_accessed")

        return True

    except Exception as e:
        print(f"❌ Error during schema update: {e}")
        return False

if __name__ == "__main__":
    success = force_schema_update()
    if success:
        print("\n🎉 Schema update complete! You can now run: python seed_database.py")
    else:
        print("\n❌ Schema update failed. Check the error above.")
