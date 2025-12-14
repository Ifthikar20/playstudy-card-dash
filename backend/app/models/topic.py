"""
Topic database model.
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.study_session import GUID


class Topic(Base):
    """Topic model for organizing questions within study sessions."""

    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    study_session_id = Column(GUID(), ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, index=True)  # For hierarchical structure
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)  # Order in the session
    is_category = Column(Boolean, default=False)  # True if this is a category/section, False if it's a leaf topic with questions
    completed = Column(Boolean, default=False)
    score = Column(Integer, nullable=True)  # Score as percentage 0-100
    current_question_index = Column(Integer, default=0)

    # Relationships
    study_session = relationship("StudySession", back_populates="topics")
    parent_topic = relationship("Topic", remote_side=[id], backref="subtopics")
    questions = relationship("Question", back_populates="topic", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Topic(id={self.id}, title={self.title}, session_id={self.study_session_id})>"
