/**
 * Browser Text-to-Speech Provider
 *
 * Fallback provider using browser's built-in speech synthesis
 * No API key required, but quality varies by browser
 */

import { ITTSProvider, TTSVoiceOptions, TTSVoiceInfo } from './types';

export class BrowserTTSProvider implements ITTSProvider {
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if ('speechSynthesis' in window) {
      // Load voices
      this.loadVoices();
      // Voices may load asynchronously
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    this.voices = speechSynthesis.getVoices();
  }

  isConfigured(): boolean {
    return 'speechSynthesis' in window;
  }

  getProviderName(): string {
    return 'Browser TTS';
  }

  async generateSpeech(
    text: string,
    options: Partial<TTSVoiceOptions> = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Browser TTS is not supported in your browser');
    }

    // Browser TTS doesn't generate audio URLs, it speaks directly
    // This method is here for interface compatibility
    // Actual speaking happens in the speak method
    throw new Error('Browser TTS does not support audio URL generation. Use speak() method instead.');
  }

  /**
   * Speak text directly using browser TTS
   * This is a special method for browser TTS that doesn't return a URL
   */
  speak(
    text: string,
    options: Partial<TTSVoiceOptions> = {},
    onEnd?: () => void,
    onError?: (error: Error) => void
  ): SpeechSynthesisUtterance {
    if (!this.isConfigured()) {
      const error = new Error('Browser TTS is not supported in your browser');
      if (onError) onError(error);
      throw error;
    }

    const {
      voice,
      speed = 0.9,
      pitch = 1.0,
    } = options;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    utterance.pitch = pitch;
    utterance.volume = 1.0;

    // Set voice if specified
    if (voice && this.voices.length > 0) {
      const selectedVoice = this.voices.find(v => v.name === voice || v.lang === voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = (event) => {
      const error = new Error(`Browser TTS error: ${event.error}`);
      if (onError) onError(error);
    };

    // Cancel any ongoing speech
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);

    return utterance;
  }

  getAvailableVoices(): TTSVoiceInfo[] {
    if (!this.isConfigured()) {
      return [];
    }

    // Ensure voices are loaded
    if (this.voices.length === 0) {
      this.loadVoices();
    }

    // Convert browser voices to our format
    return this.voices.map(voice => ({
      id: voice.name,
      name: voice.name,
      description: `${voice.lang} - ${voice.localService ? 'Local' : 'Network'}`,
      language: voice.lang,
      gender: 'neutral' as const
    }));
  }

  /**
   * Pause current speech
   */
  pause(): void {
    if (this.isConfigured()) {
      speechSynthesis.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume(): void {
    if (this.isConfigured()) {
      speechSynthesis.resume();
    }
  }

  /**
   * Stop current speech
   */
  stop(): void {
    if (this.isConfigured()) {
      speechSynthesis.cancel();
    }
  }

  /**
   * Check if speech is currently playing
   */
  isPlaying(): boolean {
    if (!this.isConfigured()) {
      return false;
    }
    return speechSynthesis.speaking;
  }
}
