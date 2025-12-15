/**
 * OpenAI Text-to-Speech Provider
 *
 * Provides high-quality AI narration using OpenAI TTS API
 * Supports multiple voices and models
 */

import { ITTSProvider, TTSVoiceOptions, TTSVoiceInfo } from './types';

export type OpenAIVoiceModel = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export class OpenAITTSProvider implements ITTSProvider {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1/audio/speech';
  private audioCache: Map<string, string> = new Map();

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return 'OpenAI TTS';
  }

  async generateSpeech(
    text: string,
    options: Partial<TTSVoiceOptions> = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file'
      );
    }

    // Check cache first
    const cacheKey = `oa-${text}-${options.voice}-${options.speed}-${options.model}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    const {
      voice = 'alloy', // Default to 'alloy' voice (neutral)
      speed = 1.0,
      model = 'tts-1' // Use standard quality by default
    } = options;

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          speed,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `OpenAI TTS API error: ${error.error?.message || response.statusText}`
        );
      }

      // Convert response to blob and create URL
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Cache the audio URL
      this.audioCache.set(cacheKey, audioUrl);

      return audioUrl;
    } catch (error) {
      console.error('Error generating speech with OpenAI TTS:', error);
      throw error;
    }
  }

  getAvailableVoices(): TTSVoiceInfo[] {
    return [
      {
        id: 'alloy',
        name: 'Alloy',
        description: 'Neutral and balanced',
        gender: 'neutral'
      },
      {
        id: 'echo',
        name: 'Echo',
        description: 'Male, clear and articulate',
        gender: 'male'
      },
      {
        id: 'fable',
        name: 'Fable',
        description: 'British accent, warm',
        gender: 'male'
      },
      {
        id: 'onyx',
        name: 'Onyx',
        description: 'Deep male voice',
        gender: 'male'
      },
      {
        id: 'nova',
        name: 'Nova',
        description: 'Female, energetic',
        gender: 'female'
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        description: 'Female, soft and gentle',
        gender: 'female'
      },
    ];
  }

  /**
   * Clear audio cache to free memory
   */
  clearCache(): void {
    this.audioCache.forEach(url => URL.revokeObjectURL(url));
    this.audioCache.clear();
  }
}
