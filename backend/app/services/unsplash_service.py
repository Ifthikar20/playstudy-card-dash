"""
Unsplash Image Search Service

Fetches relevant educational images from Unsplash to enhance learning.
"""
import logging
import requests
from typing import List, Optional, Dict
from app.config import settings

logger = logging.getLogger(__name__)


class UnsplashService:
    """Service for fetching images from Unsplash API."""

    def __init__(self):
        self.access_key = settings.UNSPLASH_ACCESS_KEY
        self.base_url = "https://api.unsplash.com"
        self.enabled = bool(self.access_key and self.access_key != "your-unsplash-access-key-here")

        if self.enabled:
            logger.info("✅ Unsplash service initialized")
        else:
            logger.warning("⚠️  Unsplash service disabled - no valid API key")

    def search_images(
        self,
        query: str,
        per_page: int = 3,
        orientation: str = "landscape"
    ) -> List[Dict[str, str]]:
        """
        Search for images on Unsplash based on a query.

        Args:
            query: Search term (e.g., "photosynthesis", "French Revolution")
            per_page: Number of images to return (default: 3, max: 30)
            orientation: Image orientation - "landscape", "portrait", or "squarish"

        Returns:
            List of image dictionaries with url, thumbnail, alt_description, photographer info
        """
        if not self.enabled:
            logger.debug("Unsplash service disabled, returning empty list")
            return []

        try:
            logger.info(f"🔍 Searching Unsplash for: '{query}'")

            # Unsplash API endpoint
            url = f"{self.base_url}/search/photos"

            # Query parameters
            params = {
                "query": query,
                "per_page": min(per_page, 30),  # Max 30 per request
                "orientation": orientation,
                "content_filter": "high",  # Filter out inappropriate content
            }

            # Headers with authorization
            headers = {
                "Authorization": f"Client-ID {self.access_key}",
                "Accept-Version": "v1"
            }

            # Make request
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()

            data = response.json()
            results = data.get("results", [])

            # Format results
            images = []
            for result in results:
                images.append({
                    "id": result["id"],
                    "url": result["urls"]["regular"],  # 1080px width
                    "thumb": result["urls"]["small"],  # 400px width
                    "alt": result.get("alt_description") or result.get("description") or query,
                    "photographer": result["user"]["name"],
                    "photographer_url": result["user"]["links"]["html"],
                    "download_location": result["links"]["download_location"],  # Required for attribution
                })

            logger.info(f"✅ Found {len(images)} images for '{query}'")
            return images

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Unsplash API error: {e}")
            return []
        except Exception as e:
            logger.error(f"❌ Unexpected error in Unsplash service: {e}")
            return []

    def track_download(self, download_location: str) -> None:
        """
        Track image download for Unsplash attribution (required by API terms).

        Args:
            download_location: The download_location URL from the image data
        """
        if not self.enabled:
            return

        try:
            headers = {
                "Authorization": f"Client-ID {self.access_key}",
            }
            requests.get(download_location, headers=headers, timeout=5)
            logger.debug("✅ Tracked image download for attribution")
        except Exception as e:
            logger.warning(f"⚠️  Failed to track download: {e}")

    def get_topic_images(self, topic: str, num_images: int = 2) -> List[Dict[str, str]]:
        """
        Get relevant images for an educational topic.

        Automatically enhances the query for better educational results.

        Args:
            topic: The educational topic (e.g., "photosynthesis", "calculus")
            num_images: Number of images to return (default: 2)

        Returns:
            List of image dictionaries
        """
        # Enhance query for educational context
        enhanced_query = f"{topic} education learning"

        images = self.search_images(enhanced_query, per_page=num_images)

        # If no results, try with just the topic
        if not images:
            logger.info(f"No results for enhanced query, trying '{topic}' alone")
            images = self.search_images(topic, per_page=num_images)

        return images


# Create global instance
unsplash_service = UnsplashService()
