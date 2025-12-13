"""
Topic database model.
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Topic(Base):
    """Topic model for organizing questions within study sessions."""

    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    study_session_id = Column(Integer, ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)  # Order in the session
    completed = Column(Boolean, default=False)
    score = Column(Integer, nullable=True)  # Score as percentage 0-100
    current_question_index = Column(Integer, default=0)

    # Relationships
    study_session = relationship("StudySession", back_populates="topics")
    questions = relationship("Question", back_populates="topic", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Topic(id={self.id}, title={self.title}, session_id={self.study_session_id})>"
