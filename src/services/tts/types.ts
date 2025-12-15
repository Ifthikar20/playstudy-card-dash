/**
 * TTS Provider Types and Interfaces
 * Defines the contract for all TTS providers
 */

export type TTSProvider = 'openai' | 'google-cloud' | 'browser';

export interface TTSVoiceOptions {
  provider: TTSProvider;
  voice?: string;
  speed?: number;
  pitch?: number; // Used by Google Cloud TTS
  volumeGainDb?: number; // Used by Google Cloud TTS
  model?: string; // Used by OpenAI (tts-1, tts-1-hd)
}

export interface TTSVoiceInfo {
  id: string;
  name: string;
  description: string;
  language?: string;
  gender?: 'male' | 'female' | 'neutral';
}

export interface ITTSProvider {
  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Generate speech from text
   * Returns an audio URL that can be played
   */
  generateSpeech(text: string, options?: Partial<TTSVoiceOptions>): Promise<string>;

  /**
   * Get available voices for this provider
   */
  getAvailableVoices(): TTSVoiceInfo[];

  /**
   * Get provider name
   */
  getProviderName(): string;
}

export interface TTSAudioCallbacks {
  onEnd?: () => void;
  onError?: (error: Error) => void;
}
