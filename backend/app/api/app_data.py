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
from app.schemas.folder import FolderResponse
from app.models.user import User
from app.models.game import Game
from app.models.study_session import StudySession
from app.models.topic import Topic
from app.models.folder import Folder
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

    # Fetch user's folders
    folders = db.query(Folder).filter(
        Folder.user_id == current_user.id,
        Folder.is_archived == False
    ).order_by(Folder.created_at.desc()).all()
    logger.debug(f"📊 Found {len(folders)} folders")

    # Fetch user's study sessions - ordered by title (content-based) instead of date
    study_sessions = (
        db.query(StudySession)
        .filter(StudySession.user_id == current_user.id)
        .order_by(StudySession.title.asc())
        .all()
    )
    logger.debug(f"📊 Found {len(study_sessions)} study sessions for user {current_user.id}")

    # Fix generic session titles by using topic data
    for session in study_sessions:
        # Check if this is a generic title (contains "Study Session" and digits)
        if "Study Session" in session.title and any(char.isdigit() for char in session.title):
            # Fetch the first topic/category for this session
            first_topic = (
                db.query(Topic)
                .filter(Topic.study_session_id == session.id)
                .filter(Topic.is_category == True)
                .order_by(Topic.order_index)
                .first()
            )

            if first_topic:
                # Count total categories for this session
                total_categories = (
                    db.query(Topic)
                    .filter(Topic.study_session_id == session.id)
                    .filter(Topic.is_category == True)
                    .count()
                )

                # Generate meaningful title
                if total_categories > 1:
                    session.title = f"{first_topic.title} + {total_categories - 1} more"
                else:
                    session.title = first_topic.title

                # Update in database
                db.commit()
                logger.debug(f"📝 Updated session {session.id} title to: {session.title}")

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

    # Build folder responses with session counts
    folders_response = []
    for folder in folders:
        session_count = db.query(StudySession).filter(
            StudySession.folder_id == folder.id
        ).count()
        folders_response.append(
            FolderResponse.from_db_model(folder, session_count=session_count)
        )

    # Build final response
    response_data = AppDataResponse(
        games=games_response,
        studySessions=sessions_response,
        folders=folders_response,
        userProfile=user_profile,
        stats=user_stats,
    )

    logger.debug(f"📊 Built response with {len(games_response)} games, {len(sessions_response)} sessions")
    logger.info(f"📊 Successfully fetched app data for user {current_user.email}")

    # Cache the response for 5 minutes
    set_cache(cache_key, response_data.model_dump(), ttl=settings.CACHE_TTL)
    logger.debug(f"📊 Cached response for user {current_user.id}")

    return response_data
