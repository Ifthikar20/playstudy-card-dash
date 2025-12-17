/**
 * AI Voice Service - Frontend Client for TTS API
 *
 * This service calls the backend API for Text-to-Speech generation using OpenAI or Google Cloud.
 * All TTS logic and API keys are securely stored in the backend.
 */

export type TTSProvider = 'openai' | 'google-cloud';

export interface TTSVoiceOptions {
  provider: TTSProvider;
  voice?: string;
  speed?: number;
  pitch?: number;
  model?: string;
}

export interface TTSVoiceInfo {
  id: string;
  name: string;
  description: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
}

export interface TTSProviderInfo {
  id: TTSProvider;
  name: string;
  configured: boolean;
}

export interface TTSAudioCallbacks {
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

// Legacy type for backward compatibility
export type VoiceModel = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

class AIVoiceService {
  private apiUrl: string;
  private currentAudio: HTMLAudioElement | null = null;
  private currentProvider: TTSProvider = 'openai';
  private providersCache: TTSProviderInfo[] | null = null;
  private voicesCache: Record<string, TTSVoiceInfo[]> = {};

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Fetch available providers from backend
   */
  async fetchProviders(): Promise<TTSProviderInfo[]> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('Authentication required for TTS');
    }

    try {
      const response = await fetch(`${this.apiUrl}/tts/providers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }

      const providers = await response.json();
      this.providersCache = providers;

      return this.providersCache;
    } catch (error) {
      console.error('Error fetching providers:', error);
      throw error;
    }
  }

  /**
   * Fetch available voices from backend
   */
  async fetchVoices(provider?: string): Promise<TTSVoiceInfo[]> {
    const token = this.getAuthToken();
    const targetProvider = provider || this.currentProvider;

    if (!token) {
      throw new Error('Authentication required for TTS');
    }

    try {
      const response = await fetch(`${this.apiUrl}/tts/voices/${targetProvider}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }

      const voices = await response.json();
      this.voicesCache[targetProvider] = voices;
      return voices;
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  /**
   * Set the active TTS provider
   */
  setProvider(provider: TTSProvider): void {
    this.currentProvider = provider;
  }

  /**
   * Get the current provider
   */
  getProvider(): TTSProvider {
    return this.currentProvider;
  }

  /**
   * Get all available providers (uses cache if available)
   */
  getAvailableProviders(): TTSProviderInfo[] {
    if (this.providersCache) {
      return this.providersCache;
    }
    // Return OpenAI as default
    return [{ id: 'openai', name: 'OpenAI', configured: true }];
  }

  /**
   * Get available voices for current provider
   */
  getAvailableVoices(): TTSVoiceInfo[] {
    return this.voicesCache[this.currentProvider] || [];
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    const providers = this.getAvailableProviders();
    return providers.some(p => p.configured);
  }

  /**
   * Check if current provider is configured
   */
  isCurrentProviderConfigured(): boolean {
    const providers = this.getAvailableProviders();
    const current = providers.find(p => p.id === this.currentProvider);
    return current?.configured || false;
  }

  /**
   * Generate speech from text using backend API
   */
  async speak(
    text: string,
    options: Partial<TTSVoiceOptions> = {},
    callbacks?: TTSAudioCallbacks
  ): Promise<HTMLAudioElement | null> {
    try {
      // Stop any currently playing audio
      this.stop();

      const provider = options.provider || this.currentProvider;

      // Call backend API for TTS generation
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required for TTS');
      }

      const response = await fetch(`${this.apiUrl}/tts/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          provider,
          voice: options.voice,
          speed: options.speed || 1.0,
          pitch: options.pitch || 0.0,
          model: options.model || 'tts-1',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'TTS generation failed');
      }

      // Create audio from response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (callbacks?.onEnd) callbacks.onEnd();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        const error = new Error('Error playing audio');
        if (callbacks?.onError) callbacks.onError(error);
      };

      this.currentAudio = audio;
      await audio.play();

      return audio;
    } catch (error) {
      if (callbacks?.onError) callbacks.onError(error as Error);
      throw error;
    }
  }

  /**
   * Pause current audio
   */
  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resume paused audio
   */
  resume(): void {
    if (this.currentAudio) {
      this.currentAudio.play();
    }
  }

  /**
   * Stop and clear current audio
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  /**
   * Set volume (0 to 1)
   */
  setVolume(volume: number): void {
    if (this.currentAudio) {
      this.currentAudio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current playback state
   */
  isPlaying(): boolean {
    if (this.currentAudio) {
      return !this.currentAudio.paused;
    }
    return false;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.providersCache = null;
    this.voicesCache = {};
  }
}

// Export singleton instance
export const aiVoiceService = new AIVoiceService();
