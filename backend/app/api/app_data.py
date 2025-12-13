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
import logging

# Configure logging
logger = logging.getLogger(__name__)

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
    logger.info(f"📊 app-data request for user: {current_user.email} (ID: {current_user.id})")

    # Check cache first
    cache_key = f"app_data:{current_user.id}"
    cached_data = get_cache(cache_key)

    if cached_data:
        logger.debug(f"📊 Returning cached data for user {current_user.id}")
        return cached_data

    logger.debug(f"📊 No cache, fetching fresh data for user {current_user.id}")

    # Fetch all games (active only)
    games = db.query(Game).filter(Game.is_active == True).all()
    logger.debug(f"📊 Found {len(games)} active games")

    # Fetch user's study sessions - ordered by title (content-based) instead of date
    study_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id)
        .order_by(StudySession.title.asc())
        .all()
    )
    logger.debug(f"📊 Found {len(study_sessions)} study sessions for user {current_user.id}")

    # Build user profile using custom method
    user_profile = UserProfile.from_db_model(current_user)

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

    # Calculate total questions answered (estimated from topics_count)
    questions_answered = sum(session.topics_count * 5 for session in study_sessions)  # ~5 questions per topic

    # Create user stats using custom method
    user_stats = UserStats.from_calculations(
        total_sessions=total_sessions,
        avg_accuracy=average_accuracy,
        questions_answered=questions_answered,
        total_time_seconds=total_study_time,
    )

    # Convert to response schemas using custom methods
    games_response = [GameResponse.from_db_model(game) for game in games]
    sessions_response = [
        StudySessionResponse.from_db_model(session) for session in study_sessions
    ]

    # Build final response
    response_data = AppDataResponse(
        games=games_response,
        studySessions=sessions_response,
        userProfile=user_profile,
        stats=user_stats,
    )

    logger.debug(f"📊 Built response with {len(games_response)} games, {len(sessions_response)} sessions")
    logger.info(f"📊 Successfully fetched app data for user {current_user.email}")

    # Cache the response for 5 minutes
    set_cache(cache_key, response_data.model_dump(), ttl=settings.CACHE_TTL)
    logger.debug(f"📊 Cached response for user {current_user.id}")

    return response_data
