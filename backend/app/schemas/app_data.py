"""
App Data schema for the consolidated /api/app-data endpoint.
"""
from pydantic import BaseModel
from typing import List
from app.schemas.game import GameResponse
from app.schemas.study_session import StudySessionResponse
from app.schemas.user import UserProfile, UserStats


class AppDataResponse(BaseModel):
    """
    Main response schema for the consolidated /api/app-data endpoint.
    Returns all data needed by the frontend in a single request.
    """
    games: List[GameResponse]
    studySessions: List[StudySessionResponse]
    userProfile: UserProfile
    stats: UserStats

    class Config:
        from_attributes = True
