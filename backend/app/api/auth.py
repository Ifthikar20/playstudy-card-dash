"""
Authentication API endpoints for user registration and login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin, Token
from app.models.user import User
from app.core.security import get_password_hash, verify_password, create_access_token
from app.config import settings
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account.

    Args:
        user_data: User registration data (email, name, password)
        db: Database session

    Returns:
        JWT access token for the new user

    Raises:
        HTTPException: If email already exists
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        name=user_data.name,
        hashed_password=hashed_password,
        xp=0,
        level=1,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email},
        expires_delta=access_token_expires,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/login", response_model=Token)
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user and return JWT token.

    Args:
        login_data: User login credentials (email, password)
        db: Database session

    Returns:
        JWT access token

    Raises:
        HTTPException: If credentials are invalid
    """
    logger.info(f"🔑 Login attempt for email: {login_data.email}")

    # Get user by email
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user:
        logger.warning(f"🔑 Login failed: User not found for email {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.debug(f"🔑 User found: ID={user.id}, Name={user.name}, Active={user.is_active}")
    logger.debug(f"🔑 Stored hash (first 20 chars): {user.hashed_password[:20]}...")

    # Verify password
    password_valid = verify_password(login_data.password, user.hashed_password)

    if not password_valid:
        logger.warning(f"🔑 Login failed: Invalid password for {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info(f"🔑 Password verified successfully for {login_data.email}")

    # Check if user is active
    if not user.is_active:
        logger.warning(f"🔑 Login failed: Account inactive for {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    logger.debug(f"🔑 Creating access token with {settings.ACCESS_TOKEN_EXPIRE_MINUTES} min expiry")

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email},
        expires_delta=access_token_expires,
    )

    logger.info(f"🔑 Login successful for {login_data.email}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
