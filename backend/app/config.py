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

# Enhanced TTS configuration logging (both logger and print for visibility)
print("\n" + "=" * 70)
print("🔊 GOOGLE CLOUD TTS CONFIGURATION CHECK")
print("=" * 70)
logger.info("=" * 70)
logger.info("🔊 GOOGLE CLOUD TTS CONFIGURATION CHECK")
logger.info("=" * 70)

# Check if key exists and log details
key_exists = bool(settings.GOOGLE_CLOUD_API_KEY)
key_length = len(settings.GOOGLE_CLOUD_API_KEY) if settings.GOOGLE_CLOUD_API_KEY else 0
is_placeholder = settings.GOOGLE_CLOUD_API_KEY == "your-google-cloud-api-key-here" if settings.GOOGLE_CLOUD_API_KEY else False

print(f"📋 Key Exists: {key_exists}")
print(f"📏 Key Length: {key_length} characters")
print(f"⚠️  Is Placeholder: {is_placeholder}")

logger.info(f"📋 Key Exists: {key_exists}")
logger.info(f"📏 Key Length: {key_length} characters")
logger.info(f"⚠️  Is Placeholder: {is_placeholder}")

if settings.GOOGLE_CLOUD_API_KEY and not is_placeholder:
    print(f"✅ Status: CONFIGURED")
    print(f"🔑 API Key (first 15 chars): {settings.GOOGLE_CLOUD_API_KEY[:15]}...")
    print(f"🔑 API Key (last 8 chars): ...{settings.GOOGLE_CLOUD_API_KEY[-8:]}")
    logger.info(f"✅ Status: CONFIGURED")
    logger.info(f"🔑 API Key (first 15 chars): {settings.GOOGLE_CLOUD_API_KEY[:15]}...")
    logger.info(f"🔑 API Key (last 8 chars): ...{settings.GOOGLE_CLOUD_API_KEY[-8:]}")
elif is_placeholder:
    print(f"❌ Status: NOT CONFIGURED (placeholder value detected)")
    print(f"⚠️  Action Required: Replace placeholder in backend/.env")
    logger.warning("❌ Status: NOT CONFIGURED (placeholder value detected)")
    logger.warning("⚠️  Action Required: Replace placeholder in backend/.env")
else:
    print(f"❌ Status: NOT CONFIGURED (key missing)")
    print(f"⚠️  Add GOOGLE_CLOUD_API_KEY to backend/.env")
    logger.warning("❌ Status: NOT CONFIGURED (key missing)")
    logger.warning("⚠️  Add GOOGLE_CLOUD_API_KEY to backend/.env")

print("=" * 70 + "\n")
logger.info("=" * 70)
