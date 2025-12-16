/**
 * AI Voice Service - Frontend Client for Backend TTS API
 *
 * This service calls the backend API for Text-to-Speech generation.
 * All TTS logic and API keys are securely stored in the backend.
 */

export type TTSProvider = 'openai' | 'google-cloud' | 'browser';

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
  private browserTTS: SpeechSynthesisUtterance | null = null;
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
    return localStorage.getItem('access_token');
  }

  /**
   * Fetch available providers from backend
   */
  async fetchProviders(): Promise<TTSProviderInfo[]> {
    const token = this.getAuthToken();
    if (!token) {
      // If not authenticated, return browser TTS as fallback
      return [{ id: 'browser', name: 'Browser TTS', configured: true }];
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

      // Always add browser TTS as fallback
      if (!providers.find((p: TTSProviderInfo) => p.id === 'browser')) {
        this.providersCache.push({ id: 'browser', name: 'Browser TTS', configured: true });
      }

      return this.providersCache;
    } catch (error) {
      console.error('Error fetching providers:', error);
      // Return browser TTS as fallback
      return [{ id: 'browser', name: 'Browser TTS', configured: true }];
    }
  }

  /**
   * Fetch available voices from backend
   */
  async fetchVoices(provider?: string): Promise<TTSVoiceInfo[]> {
    const token = this.getAuthToken();
    const targetProvider = provider || this.currentProvider;

    // Browser TTS voices are handled locally
    if (targetProvider === 'browser') {
      return this.getBrowserVoices();
    }

    if (!token) {
      return [];
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
   * Get browser TTS voices
   */
  private getBrowserVoices(): TTSVoiceInfo[] {
    if (!('speechSynthesis' in window)) {
      return [];
    }

    const voices = speechSynthesis.getVoices();
    return voices.map(voice => ({
      id: voice.name,
      name: voice.name,
      description: `${voice.lang} - ${voice.localService ? 'Local' : 'Network'}`,
      language: voice.lang,
      gender: 'neutral' as const
    }));
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
    // Return browser TTS as initial fallback
    return [{ id: 'browser', name: 'Browser TTS', configured: true }];
  }

  /**
   * Get available voices for current provider
   */
  getAvailableVoices(): TTSVoiceInfo[] {
    if (this.currentProvider === 'browser') {
      return this.getBrowserVoices();
    }
    return this.voicesCache[this.currentProvider] || [];
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return true; // Always true since browser TTS is always available
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
   * Generate speech from text using backend API or browser TTS
   */
  async speak(
    text: string,
    options: Partial<TTSVoiceOptions> = {},
    callbacks?: TTSAudioCallbacks
  ): Promise<HTMLAudioElement | SpeechSynthesisUtterance | null> {
    try {
      // Stop any currently playing audio
      this.stop();

      const provider = options.provider || this.currentProvider;

      // Use browser TTS for browser provider or if not authenticated
      if (provider === 'browser' || !this.getAuthToken()) {
        return this.speakBrowser(text, options, callbacks);
      }

      // Call backend API for TTS generation
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('Authentication required for API-based TTS');
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
   * Speak using browser TTS
   */
  private speakBrowser(
    text: string,
    options: Partial<TTSVoiceOptions>,
    callbacks?: TTSAudioCallbacks
  ): SpeechSynthesisUtterance {
    if (!('speechSynthesis' in window)) {
      const error = new Error('Browser TTS not supported');
      if (callbacks?.onError) callbacks.onError(error);
      throw error;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.speed || 0.9;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = 1.0;

    // Set voice if specified
    if (options.voice) {
      const voices = speechSynthesis.getVoices();
      const selectedVoice = voices.find(v => v.name === options.voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onend = () => {
      if (callbacks?.onEnd) callbacks.onEnd();
    };

    utterance.onerror = (event) => {
      const error = new Error(`Browser TTS error: ${event.error}`);
      if (callbacks?.onError) callbacks.onError(error);
    };

    this.browserTTS = utterance;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);

    return utterance;
  }

  /**
   * Pause current audio
   */
  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
    } else if ('speechSynthesis' in window) {
      speechSynthesis.pause();
    }
  }

  /**
   * Resume paused audio
   */
  resume(): void {
    if (this.currentAudio) {
      this.currentAudio.play();
    } else if ('speechSynthesis' in window) {
      speechSynthesis.resume();
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
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    this.browserTTS = null;
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
    if ('speechSynthesis' in window) {
      return speechSynthesis.speaking;
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

// Export fallback function for direct browser TTS access (backward compatibility)
export function useBrowserTTS(
  text: string,
  options: { rate?: number; pitch?: number; volume?: number } = {}
): SpeechSynthesisUtterance | null {
  if (!('speechSynthesis' in window)) {
    console.error('Browser TTS not supported');
    return null;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate || 0.9;
  utterance.pitch = options.pitch || 1.0;
  utterance.volume = options.volume || 1.0;

  return utterance;
}
