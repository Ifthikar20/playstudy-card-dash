/**
 * Image Service - Fetches educational images from Unsplash
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface UnsplashImage {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  photographer_url: string;
  download_location: string;
}

/**
 * Get the authentication token from localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * Search for images based on a query
 */
export async function searchImages(
  query: string,
  numImages: number = 3
): Promise<UnsplashImage[]> {
  const token = getAuthToken();
  if (!token) {
    console.warn('Not authenticated - cannot fetch images');
    return [];
  }

  try {
    const response = await fetch(
      `${API_URL}/images/search?query=${encodeURIComponent(query)}&num_images=${numImages}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn('Image search failed:', response.statusText);
      return [];
    }

    const images: UnsplashImage[] = await response.json();
    return images;
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
}

/**
 * Get educational images for a specific topic
 * Automatically enhances the query for better educational results
 */
export async function getTopicImages(
  topic: string,
  numImages: number = 2
): Promise<UnsplashImage[]> {
  const token = getAuthToken();
  if (!token) {
    console.warn('Not authenticated - cannot fetch images');
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/images/topic`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic, num_images: numImages }),
    });

    if (!response.ok) {
      console.warn('Topic images fetch failed:', response.statusText);
      return [];
    }

    const images: UnsplashImage[] = await response.json();

    // Track downloads for attribution (Unsplash API requirement)
    images.forEach(image => trackImageDownload(image.download_location));

    return images;
  } catch (error) {
    console.error('Error fetching topic images:', error);
    return [];
  }
}

/**
 * Track image download for Unsplash attribution
 * Required by Unsplash API terms - call when image is displayed
 */
export async function trackImageDownload(downloadLocation: string): Promise<void> {
  const token = getAuthToken();
  if (!token) return;

  try {
    await fetch(`${API_URL}/images/track-download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ download_location: downloadLocation }),
    });
  } catch (error) {
    // Silent fail - tracking is nice to have but not critical
    console.debug('Image download tracking failed:', error);
  }
}

/**
 * Check if the image service is available
 */
export async function isImageServiceAvailable(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_URL}/images/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.enabled === true;
  } catch (error) {
    console.debug('Image service status check failed:', error);
    return false;
  }
}
