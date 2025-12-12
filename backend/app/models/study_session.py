"""
Study Session database model.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class StudySession(Base):
    """Study session model for tracking user study activity."""

    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="SET NULL"), nullable=True)
    topic = Column(String, nullable=False)
    duration = Column(Integer, nullable=False)  # in seconds
    xp_earned = Column(Integer, default=0)
    accuracy = Column(Integer, nullable=True)  # percentage 0-100
    status = Column(String, default="completed")  # completed, in_progress, abandoned
    is_completed = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="study_sessions")

    def __repr__(self):
        return f"<StudySession(id={self.id}, user_id={self.user_id}, topic={self.topic})>"
