#!/usr/bin/env python3
"""
Apply audio sync fix to MentorModePage.tsx
"""

import re

# Read the file
with open('src/pages/MentorModePage.tsx', 'r') as f:
    content = f.read()

# Find and replace the speakContent function
old_pattern = r'const speakContent = async \(topic: any\) => \{[\s\S]*?^\  \};$'

new_function = '''const speakContent = async (topic: any) => {
    setIsReading(true);
    setIsLoading(true);
    setError(null);

    let transcriptInterval: NodeJS.Timeout | null = null;
    let currentAudioElement: HTMLAudioElement | null = null;

    try {
      // Get AI-generated content from DeepSeek
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

      console.log('[Mentor Mode] Requesting AI-generated content from DeepSeek...');

      const topicDbId = typeof topic.db_id === 'number' ? topic.db_id : null;

      const response = await fetch(`${apiUrl}/tts/generate-mentor-content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_id: topicDbId,
          topic_title: topic.title || 'Untitled Topic',
          topic_description: topic.description || null,
          questions: Array.isArray(topic.questions) ? topic.questions : [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to generate AI content' }));
        throw new Error(errorData.detail || 'Failed to generate AI content');
      }

      const data = await response.json();
      const narrative = data.narrative;

      console.log(`[Mentor Mode] ✅ Received AI content: ${data.estimated_duration_seconds}s estimated`);
      console.log(`[Mentor Mode] Narrative length: ${narrative.length} characters`);

      setFullNarrative(narrative);
      setCurrentTranscript('');

      // Sync transcript with audio playback using actual audio timing
      const syncTranscriptWithAudio = (audio: HTMLAudioElement, fullText: string) => {
        const words = fullText.split(' ');
        const totalWords = words.length;

        const updateTranscript = () => {
          if (!audio.duration || audio.duration === 0) return;

          // Calculate how many words to show based on actual playback progress
          const progress = audio.currentTime / audio.duration;
          const wordsToShow = Math.min(Math.floor(progress * totalWords), totalWords);

          const displayedText = words.slice(0, wordsToShow).join(' ');
          setCurrentTranscript(displayedText);
        };

        // Update transcript every 100ms for smooth animation
        transcriptInterval = setInterval(updateTranscript, 100);
        audio.addEventListener('timeupdate', updateTranscript);

        return () => {
          if (transcriptInterval) clearInterval(transcriptInterval);
          audio.removeEventListener('timeupdate', updateTranscript);
        };
      };

      const handleEnd = () => {
        if (transcriptInterval) {
          clearInterval(transcriptInterval);
          transcriptInterval = null;
        }
        setCurrentTranscript(narrative);
        setIsReading(false);
        setIsPlaying(false);
        if (currentTopicIndex < topics.length - 1) {
          setProgress(((currentTopicIndex + 1) / topics.length) * 100);
        } else {
          setProgress(100);
        }
      };

      const handleError = (error: Error) => {
        if (transcriptInterval) {
          clearInterval(transcriptInterval);
          transcriptInterval = null;
        }
        console.error('[TTS Error]:', error);
        setError(`Unable to play audio: ${error.message}`);
        setIsReading(false);
        setIsPlaying(false);
        setIsLoading(false);
      };

      // Chunk text at sentence boundaries for TTS
      const chunkText = (text: string, maxLength: number = 4000): string[] => {
        if (text.length <= maxLength) return [text];

        const chunks: string[] = [];
        const sentences = text.split(/(?<=[.!?])\\s+/);
        let currentChunk = '';

        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            if (sentence.length > maxLength) {
              const words = sentence.split(' ');
              let wordChunk = '';
              for (const word of words) {
                if ((wordChunk + word).length <= maxLength) {
                  wordChunk += (wordChunk ? ' ' : '') + word;
                } else {
                  if (wordChunk) chunks.push(wordChunk);
                  wordChunk = word;
                }
              }
              currentChunk = wordChunk;
            } else {
              currentChunk = sentence;
            }
          }
        }
        if (currentChunk) chunks.push(currentChunk);
        return chunks;
      };

      // Play audio chunks sequentially with synced transcript
      const playChunksSequentially = async (chunks: string[]) => {
        console.log(`[Mentor Mode] Playing ${chunks.length} audio chunks`);

        for (let i = 0; i < chunks.length; i++) {
          console.log(`[Mentor Mode] Playing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

          await new Promise<void>((resolve, reject) => {
            aiVoiceService.speak(
              chunks[i],
              {
                voice: currentVoice,
                speed: 1.0,
                model: currentProvider === 'openai' ? 'tts-1' : undefined,
                pitch: 0,
                provider: currentProvider
              },
              {
                onEnd: () => {
                  console.log(`[Mentor Mode] ✅ Chunk ${i + 1}/${chunks.length} complete`);
                  resolve();
                },
                onError: (error) => {
                  console.error(`[Mentor Mode] ❌ Chunk ${i + 1}/${chunks.length} failed:`, error);
                  reject(error);
                }
              }
            ).then((audio) => {
              // Sync transcript with FIRST audio chunk
              if (audio && i === 0) {
                console.log('[Mentor Mode] 🎯 Syncing transcript with audio playback');
                currentAudioElement = audio;
                syncTranscriptWithAudio(audio, narrative);
              }
            }).catch(reject);
          });
        }
      };

      setIsLoading(true);

      // Chunk and play
      const chunks = chunkText(narrative);
      console.log(`[Mentor Mode] Split narrative into ${chunks.length} chunks`);

      await playChunksSequentially(chunks);

      // All chunks played
      handleEnd();
      setIsLoading(false);

    } catch (aiError) {
      console.error('[Mentor Mode] Failed to get AI content:', aiError);
      const errorMessage = aiError instanceof Error ? aiError.message : 'Failed to generate lesson content';

      if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
        setError('⚙️ API keys not configured. Please add DEEPSEEK_API_KEY and OPENAI_API_KEY to backend/.env file.');
      } else if (errorMessage.includes('timeout')) {
        setError('⏱️ Request timed out. The AI is taking too long. Please try again.');
      } else {
        setError(`❌ ${errorMessage}`);
      }

      if (transcriptInterval) {
        clearInterval(transcriptInterval);
        transcriptInterval = null;
      }
      setIsReading(false);
      setIsPlaying(false);
      setIsLoading(false);
    } catch (error) {
      console.error('[Mentor Mode] Error in speakContent:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(`⚠️ ${errorMessage}`);
      if (transcriptInterval) {
        clearInterval(transcriptInterval);
        transcriptInterval = null;
      }
      setIsReading(false);
      setIsPlaying(false);
      setIsLoading(false);
    }
  };'''

# Replace the function
content_updated = re.sub(old_pattern, new_function, content, flags=re.MULTILINE)

# Write back
with open('src/pages/MentorModePage.tsx', 'w') as f:
    f.write(content_updated)

print("✅ Audio sync fix applied!")
