"""
Application configuration settings.
"""
import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str
    CACHE_TTL: int = 300  # 5 minutes

    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: str
    ALLOWED_CREDENTIALS: bool = True

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # App
    API_V1_PREFIX: str = "/api"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # DeepSeek AI
    DEEPSEEK_API_KEY: str

    # TTS Provider (Optional)
    GOOGLE_CLOUD_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
    )

    @property
    def allowed_origins_list(self) -> List[str]:
        """Convert comma-separated origins string to list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]


# Create global settings instance
settings = Settings()

# Log TTS configuration status
logger.info("=" * 60)
logger.info("GOOGLE CLOUD TTS CONFIGURATION")
logger.info("=" * 60)
logger.info(f"Status: {'✅ Configured' if settings.GOOGLE_CLOUD_API_KEY else '❌ Not configured'}")
if settings.GOOGLE_CLOUD_API_KEY:
    logger.info(f"API Key (first 10 chars): {settings.GOOGLE_CLOUD_API_KEY[:10]}...")
else:
    logger.warning("⚠️  Google Cloud TTS is not configured. Add GOOGLE_CLOUD_API_KEY to backend/.env")
logger.info("=" * 60)
