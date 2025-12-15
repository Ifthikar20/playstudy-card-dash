/**
 * AI Voice Service - Multi-Provider TTS Manager
 *
 * Provides high-quality AI narration for educational content
 * Supports multiple TTS providers: OpenAI, Google Cloud, and Browser TTS
 */

import { OpenAITTSProvider } from './tts/openaiProvider';
import { GoogleCloudTTSProvider } from './tts/googleCloudProvider';
import { BrowserTTSProvider } from './tts/browserProvider';
import { ITTSProvider, TTSProvider, TTSVoiceOptions, TTSVoiceInfo, TTSAudioCallbacks } from './tts/types';

// Re-export types for backward compatibility
export type { TTSProvider, TTSVoiceOptions, TTSVoiceInfo };

// Legacy type for backward compatibility
export type VoiceModel = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

class AIVoiceService {
  private providers: Map<TTSProvider, ITTSProvider>;
  private currentProvider: TTSProvider;
  private currentAudio: HTMLAudioElement | null = null;
  private browserTTSProvider: BrowserTTSProvider;

  constructor() {
    // Initialize all providers
    this.providers = new Map([
      ['openai', new OpenAITTSProvider()],
      ['google-cloud', new GoogleCloudTTSProvider()],
      ['browser', new BrowserTTSProvider()],
    ]);

    this.browserTTSProvider = this.providers.get('browser') as BrowserTTSProvider;

    // Set default provider based on what's configured
    this.currentProvider = this.getDefaultProvider();
  }

  /**
   * Get the default provider based on configuration
   */
  private getDefaultProvider(): TTSProvider {
    if (this.providers.get('openai')?.isConfigured()) {
      return 'openai';
    }
    if (this.providers.get('google-cloud')?.isConfigured()) {
      return 'google-cloud';
    }
    return 'browser';
  }

  /**
   * Set the active TTS provider
   */
  setProvider(provider: TTSProvider): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    this.currentProvider = provider;
  }

  /**
   * Get the current provider
   */
  getProvider(): TTSProvider {
    return this.currentProvider;
  }

  /**
   * Get all available providers with their configuration status
   */
  getAvailableProviders(): Array<{ id: TTSProvider; name: string; configured: boolean }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      name: provider.getProviderName(),
      configured: provider.isConfigured(),
    }));
  }

  /**
   * Checks if any provider is configured (including browser)
   */
  isConfigured(): boolean {
    return Array.from(this.providers.values()).some(provider => provider.isConfigured());
  }

  /**
   * Checks if the current provider is configured
   */
  isCurrentProviderConfigured(): boolean {
    const provider = this.providers.get(this.currentProvider);
    return provider ? provider.isConfigured() : false;
  }

  /**
   * Generate speech from text using the current provider
   */
  async generateSpeech(
    text: string,
    options: Partial<TTSVoiceOptions> = {}
  ): Promise<string> {
    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error(`Provider ${this.currentProvider} not found`);
    }

    if (!provider.isConfigured()) {
      throw new Error(`Provider ${this.currentProvider} is not configured`);
    }

    // Add provider to options
    const providerOptions = { ...options, provider: this.currentProvider };

    return provider.generateSpeech(text, providerOptions);
  }

  /**
   * Play audio from text using the current provider
   */
  async speak(
    text: string,
    options: Partial<TTSVoiceOptions> = {},
    callbacks?: TTSAudioCallbacks
  ): Promise<HTMLAudioElement | SpeechSynthesisUtterance | null> {
    try {
      // Stop any currently playing audio
      this.stop();

      const provider = this.providers.get(this.currentProvider);
      if (!provider) {
        throw new Error(`Provider ${this.currentProvider} not found`);
      }

      if (!provider.isConfigured()) {
        throw new Error(
          `${provider.getProviderName()} is not configured. Please add the necessary API key to your .env file`
        );
      }

      // Add provider to options
      const providerOptions = { ...options, provider: this.currentProvider };

      // Browser TTS uses direct speech synthesis
      if (this.currentProvider === 'browser') {
        const utterance = this.browserTTSProvider.speak(
          text,
          providerOptions,
          callbacks?.onEnd,
          callbacks?.onError
        );
        return utterance;
      }

      // API-based providers generate audio URLs
      const audioUrl = await provider.generateSpeech(text, providerOptions);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        if (callbacks?.onEnd) callbacks.onEnd();
      };

      audio.onerror = () => {
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
    if (this.currentProvider === 'browser') {
      this.browserTTSProvider.pause();
    } else if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resume paused audio
   */
  resume(): void {
    if (this.currentProvider === 'browser') {
      this.browserTTSProvider.resume();
    } else if (this.currentAudio) {
      this.currentAudio.play();
    }
  }

  /**
   * Stop and clear current audio
   */
  stop(): void {
    if (this.currentProvider === 'browser') {
      this.browserTTSProvider.stop();
    } else if (this.currentAudio) {
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
    // Note: Browser TTS volume is controlled by the utterance, not globally
  }

  /**
   * Get current playback state
   */
  isPlaying(): boolean {
    if (this.currentProvider === 'browser') {
      return this.browserTTSProvider.isPlaying();
    }
    return this.currentAudio ? !this.currentAudio.paused : false;
  }

  /**
   * Get available voices for the current provider
   */
  getAvailableVoices(): TTSVoiceInfo[] {
    const provider = this.providers.get(this.currentProvider);
    return provider ? provider.getAvailableVoices() : [];
  }

  /**
   * Clear audio cache to free memory
   */
  clearCache(): void {
    this.providers.forEach(provider => {
      if ('clearCache' in provider) {
        (provider as any).clearCache();
      }
    });
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
