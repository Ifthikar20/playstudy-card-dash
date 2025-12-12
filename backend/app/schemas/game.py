"""
Game Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from datetime import datetime


class GameBase(BaseModel):
    """Base game schema with common fields."""
    title: str = Field(..., min_length=1, max_length=200)
    description: str
    icon: str
    category: str
    difficulty: str = Field(..., pattern="^(easy|medium|hard)$")
    estimated_time: int = Field(..., gt=0)  # in minutes
    xp_reward: int = Field(..., ge=0)


class GameCreate(GameBase):
    """Schema for creating a new game."""
    pass


class GameUpdate(BaseModel):
    """Schema for updating a game."""
    title: str | None = None
    description: str | None = None
    icon: str | None = None
    category: str | None = None
    difficulty: str | None = None
    estimated_time: int | None = None
    xp_reward: int | None = None
    is_active: bool | None = None


class GameResponse(GameBase):
    """Schema for game response."""
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
