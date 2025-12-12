"""
Study Session Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class StudySessionBase(BaseModel):
    """Base study session schema."""
    topic: str = Field(..., min_length=1, max_length=200)
    duration: int = Field(..., ge=0)  # in seconds
    game_id: Optional[int] = None
    accuracy: Optional[int] = Field(None, ge=0, le=100)


class StudySessionCreate(StudySessionBase):
    """Schema for creating a study session."""
    pass


class StudySessionUpdate(BaseModel):
    """Schema for updating a study session."""
    duration: int | None = Field(None, ge=0)
    accuracy: int | None = Field(None, ge=0, le=100)
    status: str | None = None
    is_completed: bool | None = None
    completed_at: datetime | None = None


class StudySessionResponse(StudySessionBase):
    """Schema for study session response."""
    id: int
    user_id: int
    xp_earned: int
    status: str
    is_completed: bool
    started_at: datetime
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
