/**
 * Google Cloud Text-to-Speech Provider
 *
 * Provides high-quality AI narration using Google Cloud TTS API
 * Supports multiple languages and neural voices
 */

import { ITTSProvider, TTSVoiceOptions, TTSVoiceInfo } from './types';

export class GoogleCloudTTSProvider implements ITTSProvider {
  private apiKey: string;
  private baseUrl: string = 'https://texttospeech.googleapis.com/v1/text:synthesize';
  private audioCache: Map<string, string> = new Map();

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return 'Google Cloud TTS';
  }

  async generateSpeech(
    text: string,
    options: Partial<TTSVoiceOptions> = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'Google Cloud API key not configured. Please add VITE_GOOGLE_CLOUD_API_KEY to your .env file'
      );
    }

    // Check cache first
    const cacheKey = `gc-${text}-${options.voice}-${options.speed}-${options.pitch}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    const {
      voice = 'en-US-Neural2-F', // Default to female US English neural voice
      speed = 1.0,
      pitch = 0, // 0 is neutral, range is -20 to 20
      volumeGainDb = 0 // 0 is neutral, range is -96 to 16
    } = options;

    // Parse voice name to get language code
    const languageCode = voice.split('-').slice(0, 2).join('-');

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            text: text
          },
          voice: {
            languageCode: languageCode,
            name: voice,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: speed,
            pitch: pitch,
            volumeGainDb: volumeGainDb,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Google Cloud TTS API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();

      // Google Cloud returns base64 encoded audio
      const audioContent = data.audioContent;
      const audioBlob = this.base64ToBlob(audioContent, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);

      // Cache the audio URL
      this.audioCache.set(cacheKey, audioUrl);

      return audioUrl;
    } catch (error) {
      console.error('Error generating speech with Google Cloud TTS:', error);
      throw error;
    }
  }

  getAvailableVoices(): TTSVoiceInfo[] {
    return [
      // US English Neural Voices
      {
        id: 'en-US-Neural2-A',
        name: 'US Neural Male A',
        description: 'Male, clear and professional',
        language: 'en-US',
        gender: 'male'
      },
      {
        id: 'en-US-Neural2-C',
        name: 'US Neural Female C',
        description: 'Female, warm and friendly',
        language: 'en-US',
        gender: 'female'
      },
      {
        id: 'en-US-Neural2-D',
        name: 'US Neural Male D',
        description: 'Male, authoritative',
        language: 'en-US',
        gender: 'male'
      },
      {
        id: 'en-US-Neural2-F',
        name: 'US Neural Female F',
        description: 'Female, energetic and engaging',
        language: 'en-US',
        gender: 'female'
      },
      {
        id: 'en-US-Neural2-G',
        name: 'US Neural Female G',
        description: 'Female, soft and gentle',
        language: 'en-US',
        gender: 'female'
      },
      {
        id: 'en-US-Neural2-H',
        name: 'US Neural Female H',
        description: 'Female, conversational',
        language: 'en-US',
        gender: 'female'
      },
      {
        id: 'en-US-Neural2-I',
        name: 'US Neural Male I',
        description: 'Male, deep and resonant',
        language: 'en-US',
        gender: 'male'
      },
      {
        id: 'en-US-Neural2-J',
        name: 'US Neural Male J',
        description: 'Male, casual and friendly',
        language: 'en-US',
        gender: 'male'
      },
      // UK English Neural Voices
      {
        id: 'en-GB-Neural2-A',
        name: 'UK Neural Female A',
        description: 'British female, elegant',
        language: 'en-GB',
        gender: 'female'
      },
      {
        id: 'en-GB-Neural2-B',
        name: 'UK Neural Male B',
        description: 'British male, sophisticated',
        language: 'en-GB',
        gender: 'male'
      },
      {
        id: 'en-GB-Neural2-C',
        name: 'UK Neural Female C',
        description: 'British female, professional',
        language: 'en-GB',
        gender: 'female'
      },
      {
        id: 'en-GB-Neural2-D',
        name: 'UK Neural Male D',
        description: 'British male, authoritative',
        language: 'en-GB',
        gender: 'male'
      },
      // Australian English Neural Voices
      {
        id: 'en-AU-Neural2-A',
        name: 'AU Neural Female A',
        description: 'Australian female, friendly',
        language: 'en-AU',
        gender: 'female'
      },
      {
        id: 'en-AU-Neural2-B',
        name: 'AU Neural Male B',
        description: 'Australian male, casual',
        language: 'en-AU',
        gender: 'male'
      },
      {
        id: 'en-AU-Neural2-C',
        name: 'AU Neural Female C',
        description: 'Australian female, warm',
        language: 'en-AU',
        gender: 'female'
      },
      {
        id: 'en-AU-Neural2-D',
        name: 'AU Neural Male D',
        description: 'Australian male, professional',
        language: 'en-AU',
        gender: 'male'
      }
    ];
  }

  /**
   * Clear audio cache to free memory
   */
  clearCache(): void {
    this.audioCache.forEach(url => URL.revokeObjectURL(url));
    this.audioCache.clear();
  }

  /**
   * Convert base64 string to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
}
