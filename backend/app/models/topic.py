"""
Topic database model.
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.study_session import GUID
from typing import Optional


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

    # Encrypted mentor narrative (data at rest)
    encrypted_mentor_narrative = Column(Text, nullable=True)  # Encrypted AI-generated mentor content

    # DEPRECATED: Plain text mentor narrative (kept for backward compatibility during migration)
    # Will be removed after migration is complete
    mentor_narrative = Column(Text, nullable=True)

    # Relationships
    study_session = relationship("StudySession", back_populates="topics")
    parent_topic = relationship("Topic", remote_side=[id], backref="subtopics")
    questions = relationship("Question", back_populates="topic", cascade="all, delete-orphan")

    def set_mentor_narrative(self, narrative: Optional[str]):
        """
        Set and encrypt mentor narrative

        Args:
            narrative: Plain text narrative to encrypt and store
        """
        from app.core.field_encryption import field_encryption

        if narrative:
            self.encrypted_mentor_narrative = field_encryption.encrypt(narrative)
            # Also set plain text for backward compatibility (temporary)
            self.mentor_narrative = narrative
        else:
            self.encrypted_mentor_narrative = None
            self.mentor_narrative = None

    def get_mentor_narrative(self) -> Optional[str]:
        """
        Get and decrypt mentor narrative

        Returns:
            Decrypted narrative text or None
        """
        from app.core.field_encryption import field_encryption

        # Try encrypted field first
        if self.encrypted_mentor_narrative:
            try:
                return field_encryption.decrypt(self.encrypted_mentor_narrative)
            except Exception as e:
                # Log error but fallback to plain text
                import logging
                logging.error(f"Failed to decrypt narrative for topic {self.id}: {e}")

        # Fallback to plain text (backward compatibility)
        return self.mentor_narrative

    def __repr__(self):
        return f"<Topic(id={self.id}, title={self.title}, session_id={self.study_session_id})>"
