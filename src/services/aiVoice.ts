/**
 * AI Voice Service using OpenAI Text-to-Speech API
 *
 * Provides high-quality AI narration for educational content
 * Supports multiple voices and streaming audio playback
 */

export type VoiceModel = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface VoiceOptions {
  voice?: VoiceModel;
  speed?: number; // 0.25 to 4.0
  model?: 'tts-1' | 'tts-1-hd'; // tts-1-hd has higher quality
}

class AIVoiceService {
  private apiKey: string;
  private baseUrl: string = 'https://api.openai.com/v1/audio/speech';
  private currentAudio: HTMLAudioElement | null = null;
  private audioCache: Map<string, string> = new Map(); // Cache audio URLs

  constructor() {
    // Get API key from environment variable
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  /**
   * Checks if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate speech from text using OpenAI TTS
   * Returns an audio URL that can be played
   */
  async generateSpeech(
    text: string,
    options: VoiceOptions = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your .env file');
    }

    // Check cache first
    const cacheKey = `${text}-${options.voice}-${options.speed}`;
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
        throw new Error(`OpenAI TTS API error: ${error.error?.message || response.statusText}`);
      }

      // Convert response to blob and create URL
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Cache the audio URL
      this.audioCache.set(cacheKey, audioUrl);

      return audioUrl;
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  }

  /**
   * Play audio from text
   */
  async speak(
    text: string,
    options: VoiceOptions = {},
    onEnd?: () => void,
    onError?: (error: Error) => void
  ): Promise<HTMLAudioElement> {
    try {
      // Stop any currently playing audio
      this.stop();

      const audioUrl = await this.generateSpeech(text, options);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        const error = new Error('Error playing audio');
        if (onError) onError(error);
      };

      this.currentAudio = audio;
      await audio.play();

      return audio;
    } catch (error) {
      if (onError) onError(error as Error);
      throw error;
    }
  }

  /**
   * Pause current audio
   */
  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  /**
   * Resume paused audio
   */
  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
    }
  }

  /**
   * Stop and clear current audio
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  /**
   * Set volume (0 to 1)
   */
  setVolume(volume: number) {
    if (this.currentAudio) {
      this.currentAudio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current playback state
   */
  isPlaying(): boolean {
    return this.currentAudio ? !this.currentAudio.paused : false;
  }

  /**
   * Clear audio cache to free memory
   */
  clearCache() {
    this.audioCache.forEach(url => URL.revokeObjectURL(url));
    this.audioCache.clear();
  }

  /**
   * Get available voices with descriptions
   */
  getAvailableVoices(): Array<{ id: VoiceModel; name: string; description: string }> {
    return [
      { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
      { id: 'echo', name: 'Echo', description: 'Male, clear and articulate' },
      { id: 'fable', name: 'Fable', description: 'British accent, warm' },
      { id: 'onyx', name: 'Onyx', description: 'Deep male voice' },
      { id: 'nova', name: 'Nova', description: 'Female, energetic' },
      { id: 'shimmer', name: 'Shimmer', description: 'Female, soft and gentle' },
    ];
  }
}

// Export singleton instance
export const aiVoiceService = new AIVoiceService();

// Export fallback function for browser TTS (when API key is not configured)
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
