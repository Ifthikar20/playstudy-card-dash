"""
Text-to-Speech API endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from app.services.tts_service import tts_service
from app.dependencies import get_current_user
from app.core.rate_limit import limiter
from slowapi import Limiter
from fastapi import Request

router = APIRouter()


class TTSRequest(BaseModel):
    """Request model for TTS generation."""
    text: str = Field(..., min_length=1, max_length=5000, description="Text to convert to speech")
    provider: str = Field(default="openai", description="TTS provider (openai or google-cloud)")
    voice: Optional[str] = Field(default=None, description="Voice ID to use")
    speed: Optional[float] = Field(default=1.0, ge=0.25, le=4.0, description="Speech speed")
    pitch: Optional[float] = Field(default=0.0, ge=-20.0, le=20.0, description="Voice pitch (Google Cloud only)")
    model: Optional[str] = Field(default="tts-1", description="Model to use (OpenAI only: tts-1 or tts-1-hd)")


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
    Generate speech from text using TTS providers.

    - **text**: Text to convert (max 5000 characters)
    - **provider**: TTS provider (openai or google-cloud)
    - **voice**: Voice ID (provider-specific)
    - **speed**: Speaking speed (0.25 to 4.0)
    - **pitch**: Voice pitch for Google Cloud (-20 to 20)
    - **model**: Model for OpenAI (tts-1 or tts-1-hd)

    Returns MP3 audio data that can be played in a browser.
    """
    try:
        # Prepare provider-specific parameters
        kwargs = {
            "speed": tts_request.speed,
        }

        if tts_request.provider == "openai":
            kwargs["model"] = tts_request.model
        elif tts_request.provider == "google-cloud":
            kwargs["pitch"] = tts_request.pitch
            kwargs["volume_gain_db"] = 0.0

        # Generate speech
        audio_data = await tts_service.generate_speech(
            text=tts_request.text,
            provider_name=tts_request.provider,
            voice=tts_request.voice,
            **kwargs
        )

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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
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
        providers = tts_service.get_available_providers()
        return providers
    except Exception as e:
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
