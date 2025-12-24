#!/usr/bin/env python3
"""
Database Inspection Tool
Quickly view and analyze your PlayStudy database
"""
import sys
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models.user import User
from app.models.study_session import StudySession
from app.models.question import Question
from app.models.topic import Topic
from app.models.folder import Folder

def get_db():
    """Create database connection"""
    engine = create_engine(str(settings.DATABASE_URL))
    Session = sessionmaker(bind=engine)
    return Session(), engine

def print_section(title):
    """Print section header"""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")

def main():
    """Main inspection function"""
    try:
        db, engine = get_db()
        inspector = inspect(engine)

        # 1. List all tables
        print_section("DATABASE TABLES")
        tables = inspector.get_table_names()
        for table in tables:
            print(f"  ✓ {table}")

        # 2. Record counts
        print_section("RECORD COUNTS")
        models = [
            ("Users", User),
            ("Study Sessions", StudySession),
            ("Questions", Question),
            ("Topics", Topic),
            ("Folders", Folder),
        ]

        for name, model in models:
            count = db.query(model).count()
            print(f"  {name:.<30} {count:>5}")

        # 3. Recent users
        print_section("USERS")
        users = db.query(User).order_by(User.created_at.desc()).limit(10).all()
        if users:
            print(f"  {'ID':<5} {'Email':<30} {'Name':<20} {'XP':<8} {'Created'}")
            print(f"  {'-'*5} {'-'*30} {'-'*20} {'-'*8} {'-'*20}")
            for user in users:
                created = user.created_at.strftime('%Y-%m-%d %H:%M')
                print(f"  {user.id:<5} {user.email:<30} {user.name:<20} {user.xp:<8} {created}")
        else:
            print("  No users found")

        # 4. Recent study sessions
        print_section("RECENT STUDY SESSIONS")
        sessions = db.query(StudySession).order_by(StudySession.created_at.desc()).limit(10).all()
        if sessions:
            print(f"  {'ID (short)':<12} {'Title':<35} {'User':<20} {'Q':<4} {'Topics':<6}")
            print(f"  {'-'*12} {'-'*35} {'-'*20} {'-'*4} {'-'*6}")
            for session in sessions:
                user = db.query(User).filter(User.id == session.user_id).first()
                q_count = db.query(Question).filter(Question.study_session_id == session.id).count()
                t_count = db.query(Topic).filter(Topic.study_session_id == session.id).count()
                title = session.title[:35] if session.title else "Untitled"
                user_name = user.name[:20] if user else "Unknown"
                print(f"  {str(session.id)[:12]:<12} {title:<35} {user_name:<20} {q_count:<4} {t_count:<6}")
        else:
            print("  No study sessions found")

        # 5. Questions breakdown
        print_section("QUESTIONS BREAKDOWN")
        result = db.execute(text("""
            SELECT
                s.title,
                COUNT(q.id) as question_count,
                SUM(CASE WHEN q.difficulty = 'easy' THEN 1 ELSE 0 END) as easy,
                SUM(CASE WHEN q.difficulty = 'medium' THEN 1 ELSE 0 END) as medium,
                SUM(CASE WHEN q.difficulty = 'hard' THEN 1 ELSE 0 END) as hard
            FROM study_sessions s
            LEFT JOIN questions q ON q.study_session_id = s.id
            GROUP BY s.id, s.title
            HAVING COUNT(q.id) > 0
            ORDER BY COUNT(q.id) DESC
            LIMIT 10
        """))

        rows = result.fetchall()
        if rows:
            print(f"  {'Session Title':<40} {'Total':<7} {'Easy':<6} {'Med':<6} {'Hard':<6}")
            print(f"  {'-'*40} {'-'*7} {'-'*6} {'-'*6} {'-'*6}")
            for row in rows:
                title = (row[0][:40] if row[0] else "Untitled")
                print(f"  {title:<40} {row[1]:<7} {row[2]:<6} {row[3]:<6} {row[4]:<6}")
        else:
            print("  No questions found")

        # 6. Topic hierarchy example
        print_section("TOPIC HIERARCHY (Latest Session)")
        latest_session = db.query(StudySession).order_by(StudySession.created_at.desc()).first()
        if latest_session:
            print(f"  Session: {latest_session.title}")
            topics = db.query(Topic).filter(
                Topic.study_session_id == latest_session.id
            ).order_by(Topic.parent_topic_id.is_(None).desc(), Topic.order_index).all()

            # Group topics by parent
            root_topics = [t for t in topics if t.parent_topic_id is None]

            def print_topic_tree(topic, indent=0):
                prefix = "  " * indent + ("└─ " if indent > 0 else "")
                q_count = db.query(Question).filter(Question.topic_id == topic.id).count()
                print(f"    {prefix}{topic.title} ({q_count} questions)")

                # Find children
                children = [t for t in topics if t.parent_topic_id == topic.id]
                for child in children:
                    print_topic_tree(child, indent + 1)

            for root in root_topics:
                print_topic_tree(root)
        else:
            print("  No sessions found")

        # 7. Database statistics
        print_section("DATABASE STATISTICS")
        db_size = db.execute(text(f"SELECT pg_size_pretty(pg_database_size('playstudy_db'))")).scalar()
        print(f"  Database Size: {db_size}")

        print("\n✅ Inspection complete!\n")

    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        print(f"\nMake sure PostgreSQL is running and configured correctly.")
        print(f"Connection string: {settings.DATABASE_URL}\n")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
