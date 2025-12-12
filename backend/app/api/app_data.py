"""
Main consolidated API endpoint for app data.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_active_user
from app.schemas.app_data import AppDataResponse
from app.schemas.user import UserProfile, UserStats
from app.schemas.game import GameResponse
from app.schemas.study_session import StudySessionResponse
from app.models.user import User
from app.models.game import Game
from app.models.study_session import StudySession
from app.core.cache import get_cache, set_cache
from app.core.rate_limit import limiter
from app.config import settings

router = APIRouter()


@router.get("/app-data", response_model=AppDataResponse)
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def get_app_data(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all application data in a single consolidated request.

    This endpoint returns:
    - All available games
    - User's study sessions
    - User profile data
    - User statistics

    The response is cached for 5 minutes to improve performance.

    Args:
        request: FastAPI request object (required for rate limiting)
        current_user: The authenticated user
        db: Database session

    Returns:
        AppDataResponse containing all application data

    Rate Limits:
        - 30 requests per minute per user
        - 1000 requests per hour globally
    """
    # Check cache first
    cache_key = f"app_data:{current_user.id}"
    cached_data = get_cache(cache_key)

    if cached_data:
        return cached_data

    # Fetch all games (active only)
    games = db.query(Game).filter(Game.is_active == True).all()

    # Fetch user's study sessions
    study_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id)
        .order_by(StudySession.created_at.desc())
        .all()
    )

    # Build user profile
    user_profile = UserProfile(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        xp=current_user.xp,
        level=current_user.level,
        created_at=current_user.created_at,
    )

    # Calculate user statistics
    total_sessions = len(study_sessions)
    total_study_time = sum(session.duration for session in study_sessions)

    # Calculate average accuracy (only from sessions with accuracy data)
    sessions_with_accuracy = [s for s in study_sessions if s.accuracy is not None]
    average_accuracy = (
        sum(s.accuracy for s in sessions_with_accuracy) / len(sessions_with_accuracy)
        if sessions_with_accuracy
        else 0.0
    )

    # Calculate streak (simplified - consecutive days would require date logic)
    current_streak = min(total_sessions, 7)  # Placeholder logic
    longest_streak = min(total_sessions, 10)  # Placeholder logic

    user_stats = UserStats(
        total_sessions=total_sessions,
        total_study_time=total_study_time,
        average_accuracy=round(average_accuracy, 2),
        current_streak=current_streak,
        longest_streak=longest_streak,
        xp=current_user.xp,
        level=current_user.level,
    )

    # Convert to response schemas
    games_response = [GameResponse.model_validate(game) for game in games]
    sessions_response = [
        StudySessionResponse.model_validate(session) for session in study_sessions
    ]

    # Build final response
    response_data = AppDataResponse(
        games=games_response,
        studySessions=sessions_response,
        userProfile=user_profile,
        stats=user_stats,
    )

    # Cache the response for 5 minutes
    set_cache(cache_key, response_data.model_dump(), ttl=settings.CACHE_TTL)

    return response_data
