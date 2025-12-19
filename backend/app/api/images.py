"""
Images API endpoints for educational visual content.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.dependencies import get_current_active_user
from app.models.user import User
from app.services.unsplash_service import unsplash_service
from app.core.rate_limit import limiter
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class ImageResponse(BaseModel):
    """Response model for image data."""
    id: str
    url: str
    thumb: str
    alt: str
    photographer: str
    photographer_url: str
    download_location: str


class TopicImagesRequest(BaseModel):
    """Request model for topic-based image search."""
    topic: str
    num_images: Optional[int] = 2


@router.get("/images/search", response_model=List[ImageResponse])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def search_images(
    request: Request,
    query: str = Query(..., description="Search query for images"),
    num_images: int = Query(3, ge=1, le=10, description="Number of images to return"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Search for images based on a query.

    Requires authentication. Rate limited to prevent API abuse.
    """
    logger.info(f"🖼️  Image search request from user {current_user.id}: '{query}'")

    if not unsplash_service.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image search service is not available. Please configure UNSPLASH_ACCESS_KEY."
        )

    images = unsplash_service.search_images(query, per_page=num_images)

    if not images:
        logger.warning(f"No images found for query: '{query}'")
        return []

    logger.info(f"✅ Returning {len(images)} images for '{query}'")
    return images


@router.post("/images/topic", response_model=List[ImageResponse])
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def get_topic_images(
    request: Request,
    data: TopicImagesRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Get educational images for a specific topic.

    Automatically enhances the query for better educational results.
    """
    logger.info(f"📚 Topic images request from user {current_user.id}: '{data.topic}'")

    if not unsplash_service.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image search service is not available. Please configure UNSPLASH_ACCESS_KEY."
        )

    images = unsplash_service.get_topic_images(data.topic, num_images=data.num_images)

    if not images:
        logger.warning(f"No images found for topic: '{data.topic}'")
        return []

    logger.info(f"✅ Returning {len(images)} images for topic '{data.topic}'")
    return images


@router.post("/images/track-download")
@limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
async def track_image_download(
    request: Request,
    download_location: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    Track image download for Unsplash attribution.

    Required by Unsplash API terms - call this when an image is displayed.
    """
    logger.debug(f"📊 Tracking image download for user {current_user.id}")

    if not unsplash_service.enabled:
        return {"success": False, "message": "Service not available"}

    unsplash_service.track_download(download_location)
    return {"success": True}


@router.get("/images/status")
async def get_image_service_status(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get the status of the image service.

    Returns whether Unsplash integration is enabled.
    """
    return {
        "enabled": unsplash_service.enabled,
        "provider": "Unsplash",
        "message": "Image service is available" if unsplash_service.enabled else "Image service requires API key configuration"
    }
