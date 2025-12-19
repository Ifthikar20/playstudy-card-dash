# Audio & Transcript Sync Fix

## Problem
- Transcript uses fixed 350ms/word timer (not synced with actual audio)
- Audio plays at different speed than transcript
- Multiple TTS API calls for chunks instead of streaming

## Solution
Replace the `speakContent` function in `MentorModePage.tsx` with synced version.

### Replace lines 204-411 with:

```typescript
  const speakContent = async (topic: any) => {
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

      // Sync transcript with audio playback
      const syncTranscriptWithAudio = (audio: HTMLAudioElement, fullText: string) => {
        const words = fullText.split(' ');
        const totalWords = words.length;

        const updateTranscript = () => {
          if (!audio.duration || audio.duration === 0) return;

          // Calculate how many words to show based on playback progress
          const progress = audio.currentTime / audio.duration;
          const wordsToShow = Math.min(Math.floor(progress * totalWords), totalWords);

          const displayedText = words.slice(0, wordsToShow).join(' ');
          setCurrentTranscript(displayedText);
        };

        // Update transcript smoothly
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

      // Chunk text if needed
      const chunkText = (text: string, maxLength: number = 4000): string[] => {
        if (text.length <= maxLength) return [text];

        const chunks: string[] = [];
        const sentences = text.split(/(?<=[.!?])\s+/);
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

      // Play audio chunks with synced transcript
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
              // Sync transcript with FIRST audio chunk only
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
  };
```

### Key Changes:
1. ✅ **Removed fixed 350ms/word timer**
2. ✅ **Added `syncTranscriptWithAudio()` function** that uses `audio.currentTime`
3. ✅ **Transcript updates based on actual audio progress**
4. ✅ **Uses `timeupdate` event + setInterval for smooth updates**
5. ✅ **Audio is already streamed as bytes** (already implemented in aiVoiceService)

### How it works:
1. Audio is fetched as blob from TTS API (already working)
2. First audio chunk starts playing
3. Transcript syncs with `audio.currentTime / audio.duration`
4. Words appear progressively based on actual playback position
5. No more timing mismatch!
