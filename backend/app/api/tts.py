"""
Text-to-Speech API endpoints.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from app.services.tts_service import tts_service
from app.dependencies import get_current_user
from app.core.rate_limit import limiter
from slowapi import Limiter
from fastapi import Request

logger = logging.getLogger(__name__)

router = APIRouter()


class TTSRequest(BaseModel):
    """Request model for TTS generation."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    provider: str = Field(default="google-cloud", description="TTS provider (google-cloud)")
    voice: Optional[str] = Field(default=None, description="Voice ID to use")
    speed: Optional[float] = Field(default=1.0, ge=0.25, le=4.0, description="Speech speed")
    pitch: Optional[float] = Field(default=0.0, ge=-20.0, le=20.0, description="Voice pitch")
    model: Optional[str] = Field(default=None, description="Deprecated - not used")


class TTSProviderInfo(BaseModel):
    """TTS provider information."""
    id: str
    name: str
    configured: bool


class VoiceInfo(BaseModel):
    """Voice information."""
    id: str
    name: str
    description: str
    language: Optional[str] = None
    gender: Optional[str] = None


@router.post(
    "/tts/generate",
    response_class=Response,
    summary="Generate speech from text",
    description="Convert text to speech using AI voices. Returns MP3 audio data.",
)
@limiter.limit("30/minute")  # Rate limit: 30 requests per minute per user
async def generate_speech(
    request: Request,
    tts_request: TTSRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate speech from text using Google Cloud Text-to-Speech.

    - **text**: Text to convert (max 5000 characters)
    - **provider**: TTS provider (google-cloud)
    - **voice**: Voice ID (e.g., en-US-Neural2-F)
    - **speed**: Speaking speed (0.25 to 4.0)
    - **pitch**: Voice pitch (-20 to 20)

    Returns MP3 audio data that can be played in a browser.
    """
    try:
        logger.info("=" * 60)
        logger.info("[API /tts/generate] TTS generation requested")
        logger.info(f"[API /tts/generate] User: {current_user.get('email', 'unknown')}")
        logger.info(f"[API /tts/generate] Provider: {tts_request.provider}")
        logger.info(f"[API /tts/generate] Voice: {tts_request.voice}")
        logger.info(f"[API /tts/generate] Text length: {len(tts_request.text)} chars")

        # Prepare parameters for Google Cloud TTS
        kwargs = {
            "speed": tts_request.speed,
            "pitch": tts_request.pitch,
            "volume_gain_db": 0.0,
        }

        # Generate speech
        logger.info(f"[API /tts/generate] Calling tts_service.generate_speech()...")
        audio_data = await tts_service.generate_speech(
            text=tts_request.text,
            provider_name=tts_request.provider,
            voice=tts_request.voice,
            **kwargs
        )

        logger.info(f"[API /tts/generate] ✅ Successfully generated {len(audio_data)} bytes of audio")
        logger.info("=" * 60)

        # Return audio as MP3
        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
                "Content-Disposition": "inline; filename=speech.mp3",
            }
        )

    except ValueError as e:
        logger.error(f"[API /tts/generate] ❌ ValueError: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"[API /tts/generate] ❌ Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"TTS generation failed: {str(e)}"
        )


@router.get(
    "/tts/providers",
    response_model=List[TTSProviderInfo],
    summary="Get available TTS providers",
    description="List all TTS providers and their configuration status",
)
async def get_providers(
    current_user: dict = Depends(get_current_user),
):
    """
    Get list of available TTS providers.

    Returns information about each provider including whether it's configured.
    """
    try:
        print("\n" + "=" * 70)
        print("🔊 [API /tts/providers] Endpoint called")
        print(f"👤 User: {current_user.get('email', 'unknown')}")
        print("=" * 70)

        logger.info("=" * 70)
        logger.info("[API /tts/providers] Endpoint called")
        logger.info(f"[API /tts/providers] User: {current_user.get('email', 'unknown')}")

        providers = tts_service.get_available_providers()

        print(f"\n📋 [API /tts/providers] Returning {len(providers)} providers:")
        for provider in providers:
            status_icon = "✅" if provider['configured'] else "❌"
            print(f"  {status_icon} {provider['id']}: configured={provider['configured']}")
        print("=" * 70 + "\n")

        logger.info(f"[API /tts/providers] Returning {len(providers)} providers:")
        for provider in providers:
            logger.info(f"  - {provider['id']}: configured={provider['configured']}")
        logger.info("=" * 70)

        return providers
    except Exception as e:
        logger.error(f"[API /tts/providers] Error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get providers: {str(e)}"
        )


@router.get(
    "/tts/voices",
    response_model=Dict[str, List[VoiceInfo]],
    summary="Get available voices",
    description="Get all available voices grouped by provider",
)
async def get_voices(
    current_user: dict = Depends(get_current_user),
):
    """
    Get all available voices grouped by provider.

    Returns a dictionary with provider names as keys and lists of voices as values.
    Only includes voices from configured providers.
    """
    try:
        voices = tts_service.get_all_voices()
        return voices
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get voices: {str(e)}"
        )


@router.get(
    "/tts/voices/{provider}",
    response_model=List[VoiceInfo],
    summary="Get voices for a specific provider",
    description="Get available voices for a specific TTS provider",
)
async def get_provider_voices(
    provider: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Get available voices for a specific provider.

    - **provider**: Provider name (openai or google-cloud)
    """
    try:
        voices = tts_service.get_provider_voices(provider)
        return voices
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get voices: {str(e)}"
        )
