"""
Database seeding script to populate initial data.
Run this after creating the database to add sample games.
"""
from app.database import SessionLocal, engine, Base
from app.models.game import Game
from app.models.user import User
from app.core.security import get_password_hash


def seed_database():
    """Seed the database with initial data."""
    # Create tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Check if games already exist
        existing_games = db.query(Game).count()
        if existing_games > 0:
            print("Games already exist, skipping game seeding...")
        else:
            # Create sample games
            games = [
                Game(
                    title="Flash Cards",
                    description="Master topics with interactive flashcards",
                    icon="🎴",
                    category="Memory",
                    difficulty="easy",
                    estimated_time=15,
                    xp_reward=50,
                    is_active=True,
                ),
                Game(
                    title="Quick Quiz",
                    description="Test your knowledge with timed questions",
                    icon="⚡",
                    category="Practice",
                    difficulty="medium",
                    estimated_time=10,
                    xp_reward=75,
                    is_active=True,
                ),
                Game(
                    title="Memory Match",
                    description="Match concepts to improve retention",
                    icon="🧩",
                    category="Memory",
                    difficulty="easy",
                    estimated_time=20,
                    xp_reward=100,
                    is_active=True,
                ),
                Game(
                    title="Speed Challenge",
                    description="Rapid-fire questions to boost your skills",
                    icon="🏃",
                    category="Speed",
                    difficulty="hard",
                    estimated_time=5,
                    xp_reward=125,
                    is_active=True,
                ),
                Game(
                    title="Deep Dive",
                    description="In-depth exploration of complex topics",
                    icon="🤿",
                    category="Study",
                    difficulty="hard",
                    estimated_time=30,
                    xp_reward=200,
                    is_active=True,
                ),
                Game(
                    title="Practice Arena",
                    description="Apply your knowledge in realistic scenarios",
                    icon="🎯",
                    category="Practice",
                    difficulty="medium",
                    estimated_time=25,
                    xp_reward=150,
                    is_active=True,
                ),
            ]

            db.add_all(games)
            db.commit()
            print(f"✓ Seeded {len(games)} games successfully!")

        # Create a test user (optional)
        existing_user = db.query(User).filter(User.email == "test@example.com").first()
        if not existing_user:
            test_user = User(
                email="test@example.com",
                name="Test User",
                hashed_password=get_password_hash("password123"),
                xp=250,
                level=3,
                is_active=True,
            )
            db.add(test_user)
            db.commit()
            print("✓ Created test user: test@example.com / password123")
        else:
            print("Test user already exists, skipping...")

        print("\n✅ Database seeding completed successfully!")

    except Exception as e:
        print(f"❌ Error seeding database: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
