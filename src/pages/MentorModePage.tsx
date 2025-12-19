import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store/appStore";
import { aiVoiceService, TTSProvider } from "@/services/aiVoice";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { parseKeyTerms, parseProgressiveKeyTerms } from "@/utils/keyTerms";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  ArrowLeft,
  Mic,
  Settings,
  MessageSquare,
  CheckCircle,
  XCircle
} from "lucide-react";

export default function MentorModePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentSession, studySessions } = useAppStore();
  const transcriptRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<TTSProvider>(aiVoiceService.getProvider());
  const [currentVoice, setCurrentVoice] = useState<string>(
    aiVoiceService.getAvailableVoices()[0]?.id || 'nova'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState(aiVoiceService.getAvailableProviders());
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [fullNarrative, setFullNarrative] = useState<string>('');
  const [mermaidCode, setMermaidCode] = useState<string | null>(null);
  const [keyTerms, setKeyTerms] = useState<string[]>([]);

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false); // Track if current topic's quiz was attempted

  const session = sessionId
    ? studySessions.find(s => s.id === sessionId) || currentSession
    : currentSession;

  useEffect(() => {
    if (!session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current && isPlaying) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [currentTranscript, isPlaying]);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Please log in to use AI Mentor Mode.');
      return;
    }

    const loadProvidersAndVoices = async () => {
      try {
        console.log('[Mentor Mode] Fetching providers...');
        const providers = await aiVoiceService.fetchProviders();
        console.log('[Mentor Mode] Providers received:', providers);
        setAvailableProviders(providers);

        // Use OpenAI as primary provider
        const configuredProvider = providers.find(p => p.configured && p.id === 'openai') || providers.find(p => p.configured);
        if (configuredProvider) {
          console.log('[Mentor Mode] Using provider:', configuredProvider.id);
          setCurrentProvider(configuredProvider.id);
          aiVoiceService.setProvider(configuredProvider.id);

          const voices = await aiVoiceService.fetchVoices(configuredProvider.id);
          console.log(`[Mentor Mode] Voices for ${configuredProvider.id}:`, voices);

          if (voices.length > 0) {
            // Use the first voice (default Google Cloud voice)
            setCurrentVoice(voices[0].id);
          }
        }
      } catch (error) {
        console.error('[Mentor Mode] Failed to load providers:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Authentication')) {
          setError('Please log in to use AI Mentor Mode.');
        } else {
          setError('Failed to initialize TTS. Please check your configuration.');
        }
      }
    };

    loadProvidersAndVoices();
  }, []);

  if (!session) {
    return null;
  }

  const topics = session.extractedTopics || [];
  const currentTopic = topics[currentTopicIndex];

  // Load cached narrative when topic changes
  useEffect(() => {
    const loadCachedNarrative = async () => {
      if (!currentTopic) return;

      const topicDbId = typeof currentTopic.db_id === 'number' ? currentTopic.db_id : null;
      console.log(`[Mentor Mode] Current topic:`, {
        id: currentTopic.id,
        db_id: currentTopic.db_id,
        topicDbId,
        title: currentTopic.title
      });

      if (!topicDbId) {
        console.log('[Mentor Mode] ⚠️ No db_id available, skipping cache check');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

      try {
        console.log(`[Mentor Mode] 📡 Fetching cached narrative from DB for topic ID ${topicDbId}`);

        const response = await fetch(`${apiUrl}/tts/generate-mentor-content`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic_id: topicDbId,
            topic_title: currentTopic.title || 'Untitled Topic',
            topic_description: currentTopic.description || null,
            questions: Array.isArray(currentTopic.questions) ? currentTopic.questions : [],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.narrative) {
            console.log(`[Mentor Mode] ✅ Narrative loaded from database (${data.narrative.length} chars, ~${data.estimated_duration_seconds}s)`);
            setFullNarrative(data.narrative);
            setCurrentTranscript(data.narrative); // Show full transcript immediately

            // Load images if available
            if (data.images && data.images.length > 0) {
              console.log(`[Mentor Mode] 🖼️ Loaded ${data.images.length} cached images`);
              setTopicImages(data.images);
            }
          } else {
            console.log('[Mentor Mode] ⚠️ Response OK but no narrative in response');
          }
        } else {
          console.log(`[Mentor Mode] ⚠️ Response not OK: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('[Mentor Mode] Error loading cached narrative:', error);
        // Silently fail - user can still click play to generate new content
      }
    };

    loadCachedNarrative();
  }, [currentTopic?.id, currentTopic?.db_id]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      aiVoiceService.pause();
    } else {
      setIsPlaying(true);
      if (currentTopic && !isReading) {
        speakContent(currentTopic);
      } else {
        aiVoiceService.resume();
      }
    }
  };

  // Handle provider change
  const handleProviderChange = async (provider: TTSProvider) => {
    aiVoiceService.stop();
    setIsPlaying(false);
    setIsReading(false);
    setCurrentProvider(provider);
    aiVoiceService.setProvider(provider);

    try {
      const voices = await aiVoiceService.fetchVoices(provider);
      if (voices.length > 0) {
        setCurrentVoice(voices[0].id);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      setError('Failed to load voices for the selected provider.');
    }
  };

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

      // Store Mermaid diagram if available
      if (data.mermaid_code) {
        console.log(`[Mentor Mode] 📊 Received Mermaid diagram`);
        setMermaidCode(data.mermaid_code);
      } else {
        setMermaidCode(null);
      }

      // Store key terms if available
      if (data.key_terms && data.key_terms.length > 0) {
        console.log(`[Mentor Mode] 🔑 Received ${data.key_terms.length} key terms`);
        setKeyTerms(data.key_terms);
      } else {
        setKeyTerms([]);
      }

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

      const handleEnd = async () => {
        if (transcriptInterval) {
          clearInterval(transcriptInterval);
          transcriptInterval = null;
        }
        setCurrentTranscript(narrative);
        setIsReading(false);
        setIsPlaying(false);

        // Play quiz announcement before showing quiz
        console.log('[Mentor Mode] Topic explanation complete - playing quiz announcement');

        const quizAnnouncement = "Great! Now let me test you on what you've learned so far. This will help reinforce the concepts we just covered.";

        try {
          await aiVoiceService.speak(
            quizAnnouncement,
            {
              voice: currentVoice,
              speed: 1.0,
              model: currentProvider === 'openai' ? 'tts-1' : undefined,
              pitch: 0,
              provider: currentProvider
            },
            {
              onEnd: () => {
                console.log('[Mentor Mode] Quiz announcement complete - showing quiz');
                setShowQuiz(true);
              },
              onError: (error) => {
                console.error('[Mentor Mode] Quiz announcement failed:', error);
                // Show quiz anyway if announcement fails
                setShowQuiz(true);
              }
            }
          );
        } catch (error) {
          console.error('[Mentor Mode] Failed to play quiz announcement:', error);
          // Show quiz anyway if announcement fails
          setShowQuiz(true);
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
    }
  };

  const handleNext = () => {
    // Can only proceed if quiz has been completed
    if (currentTopicIndex < topics.length - 1 && quizCompleted) {
      aiVoiceService.stop();
      setCurrentTopicIndex(currentTopicIndex + 1);
      setIsPlaying(false);
      setIsReading(false);
      setCurrentTranscript('');
      setTopicImages([]); // Reset images for next topic
      setQuizCompleted(false); // Reset for next topic
      setProgress(((currentTopicIndex + 1) / topics.length) * 100);
    }
  };

  const handlePrevious = () => {
    if (currentTopicIndex > 0) {
      aiVoiceService.stop();
      setCurrentTopicIndex(currentTopicIndex - 1);
      setIsPlaying(false);
      setIsReading(false);
      setCurrentTranscript('');
      setTopicImages([]); // Reset images for previous topic
      setQuizCompleted(false); // Reset for previous topic
      setProgress(((currentTopicIndex - 1) / topics.length) * 100);
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    aiVoiceService.setVolume(newMutedState ? 0 : 1);
  };

  // Quiz handlers
  const handleAnswerSelect = (answerIndex: number) => {
    if (!showFeedback) {
      setSelectedAnswer(answerIndex);
    }
  };

  const handleQuizSubmit = () => {
    if (selectedAnswer === null || !currentTopic) return;

    // Get a random question from the current topic
    const question = currentTopic.questions[0]; // For now, use first question
    const correct = selectedAnswer === question.correctAnswer;

    setIsCorrect(correct);
    setShowFeedback(true);
    setQuizCompleted(true); // Mark quiz as completed/attempted

    console.log('[Mentor Mode] Quiz submitted:', {
      selected: selectedAnswer,
      correct: question.correctAnswer,
      isCorrect: correct
    });
  };

  const handleQuizNext = () => {
    // Reset quiz state
    setShowQuiz(false);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setQuizCompleted(false); // Reset for next topic

    // Move to next topic
    if (currentTopicIndex < topics.length - 1) {
      setCurrentTopicIndex(currentTopicIndex + 1);
      setCurrentTranscript('');
      setFullNarrative('');
      setTopicImages([]); // Reset images for next topic
      setProgress(((currentTopicIndex + 1) / topics.length) * 100);
      console.log('[Mentor Mode] Moving to next topic:', currentTopicIndex + 1);
    } else {
      setProgress(100);
      console.log('[Mentor Mode] All topics completed!');
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="px-4 py-2 md:px-6 md:py-3 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Mic className="text-primary" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  AI Mentor Session
                </h1>
                <p className="text-xs text-muted-foreground">{session.title}</p>
              </div>
            </div>

            {/* Topic Counter */}
            <div className="text-sm text-muted-foreground">
              Topic {currentTopicIndex + 1} / {topics.length}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col gap-4">
          {/* Error */}
          {error && (
            <Card className="p-3 border-destructive bg-destructive/10">
              <p className="text-sm text-destructive mb-2">⚠️ {error}</p>
              {error.includes('log in') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => navigate('/auth')}
                >
                  Go to Login
                </Button>
              )}
            </Card>
          )}

          {/* Combined Conversation Area with Settings */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {/* Voice Settings - Collapsible */}
            <div className="border-b p-3">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="text-primary" />
                    <span className="text-sm font-medium">Voice Settings</span>
                  </div>
                  <span className="text-xs text-muted-foreground group-open:hidden">
                    {aiVoiceService.getAvailableVoices().find(v => v.id === currentVoice)?.name || 'Default'}
                  </span>
                </summary>
                <div className="mt-3 pt-3 border-t">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Voice</label>
                    <select
                      value={currentVoice}
                      onChange={(e) => setCurrentVoice(e.target.value)}
                      className="w-full text-sm border rounded px-2 py-1 mt-1 bg-background"
                    >
                      {aiVoiceService.getAvailableVoices().map(voice => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </details>
            </div>
            {/* Transcript */}
            <div className="flex-1 overflow-auto p-4 space-y-4" ref={transcriptRef}>
              {/* Topic Header */}
              {currentTopic && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-foreground mb-2">{currentTopic.title}</h3>
                  <p className="text-sm text-muted-foreground">{currentTopic.description}</p>
                </div>
              )}

              {/* Visual Diagram Section */}
              {mermaidCode && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-muted-foreground">📊 Visual Concept Map</span>
                  </div>
                  <MermaidDiagram code={mermaidCode} className="w-full" />
                </div>
              )}

              {/* Key Terms Section */}
              {keyTerms.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-muted-foreground">🔑 Key Terms to Know</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keyTerms.map((term, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Transcript */}
              {currentTranscript && (
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 bg-accent/50 rounded-lg p-4">
                    <div className="text-xs font-medium text-primary mb-2">Your AI Mentor</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {currentTranscript.split('\n').map((line, index) => {
                        // Parse and highlight key terms in the line
                        const { highlightedText } = parseKeyTerms(line);

                        // Format with minimal styling for natural flow
                        // Headers with emojis or ALL CAPS
                        if (line.match(/^[🎯📚💡✅🌍❓📌🎓]/)) {
                          return <div key={index} className="font-semibold text-primary mt-4 mb-2">{highlightedText}</div>;
                        }
                        // Examples
                        else if (line.match(/^(Example \d+:|For example,|Consider)/i)) {
                          return <div key={index} className="ml-4 mt-2 text-foreground/90 italic border-l-2 border-primary/30 pl-3">{highlightedText}</div>;
                        }
                        // Numbered or bulleted lists
                        else if (line.match(/^(\d+\.|-|\*)\s/)) {
                          return <div key={index} className="ml-4 mt-1">{highlightedText}</div>;
                        }
                        // Section dividers
                        else if (line.match(/^[━─-]{3,}$/)) {
                          return <div key={index} className="border-t border-border my-4"></div>;
                        }
                        // Empty lines for spacing
                        else if (line.trim() === '') {
                          return <div key={index} className="h-2"></div>;
                        }
                        // Regular paragraphs
                        else {
                          return <div key={index} className="leading-relaxed mt-1">{highlightedText}</div>;
                        }
                      })}
                      {isPlaying && currentTranscript !== fullNarrative && (
                        <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Placeholder */}
              {!currentTranscript && !isLoading && (
                <div className="flex items-center justify-center h-full text-center">
                  <div className="text-muted-foreground">
                    <Mic size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Click play to start your lesson</p>
                    <p className="text-xs mt-2">Your AI mentor will explain the concepts here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="border-t p-4">
              {/* Quiz completion hint */}
              {!quizCompleted && currentTopicIndex < topics.length - 1 && currentTranscript && (
                <div className="text-center mb-3">
                  <p className="text-xs text-muted-foreground">
                    Complete the quiz after the lesson to proceed to the next topic
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={currentTopicIndex === 0}
                  title="Previous Topic"
                >
                  <SkipBack size={18} />
                </Button>

                <Button
                  size="lg"
                  className="w-14 h-14 rounded-full"
                  onClick={handlePlayPause}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="text-xs">...</span>
                  ) : isPlaying ? (
                    <Pause size={22} />
                  ) : (
                    <Play size={22} className="ml-0.5" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  disabled={currentTopicIndex === topics.length - 1 || !quizCompleted}
                  title={!quizCompleted ? "Complete the quiz to proceed" : "Next Topic"}
                >
                  <SkipForward size={18} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </Button>
              </div>

              {isLoading ? (
                <div className="mt-4">
                  <LoadingSpinner message="Preparing your lesson..." size="sm" />
                </div>
              ) : (
                <div className="text-center mt-3 text-xs text-muted-foreground">
                  {isPlaying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Speaking
                    </span>
                  ) : (
                    'Ready to learn'
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Quiz Modal */}
      <Dialog open={showQuiz} onOpenChange={setShowQuiz}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="text-primary" size={24} />
              Quick Knowledge Check
            </DialogTitle>
            <DialogDescription>
              Test your understanding of what you just learned
            </DialogDescription>
          </DialogHeader>

          {currentTopic && currentTopic.questions.length > 0 ? (
            <div className="space-y-4 mt-4">
              {/* Question */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground">
                  {currentTopic.questions[0].question}
                </p>
              </div>

              {/* Answer Options */}
              <div className="space-y-2">
                {currentTopic.questions[0].options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrectAnswer = index === currentTopic.questions[0].correctAnswer;
                  const showCorrect = showFeedback && isCorrectAnswer;
                  const showIncorrect = showFeedback && isSelected && !isCorrect;

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={showFeedback}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                        showCorrect
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                          : showIncorrect
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                          : isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-accent'
                      } ${showFeedback ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex-1">{option}</span>
                        {showCorrect && <CheckCircle className="text-green-600" size={20} />}
                        {showIncorrect && <XCircle className="text-red-600" size={20} />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {showFeedback && (
                <div
                  className={`p-4 rounded-lg ${
                    isCorrect
                      ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                      : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="text-green-600 mt-0.5" size={20} />
                    ) : (
                      <MessageSquare className="text-blue-600 mt-0.5" size={20} />
                    )}
                    <div>
                      <p className="font-medium mb-1">
                        {isCorrect ? 'Correct! 🎉' : 'Good try! 💡'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currentTopic.questions[0].explanation}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                {!showFeedback ? (
                  <Button
                    onClick={handleQuizSubmit}
                    disabled={selectedAnswer === null}
                    className="min-w-[120px]"
                  >
                    Submit Answer
                  </Button>
                ) : (
                  <Button onClick={handleQuizNext} className="min-w-[120px]">
                    {currentTopicIndex < topics.length - 1 ? 'Next Topic →' : 'Complete 🎉'}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No questions available for this topic.
              <Button onClick={handleQuizNext} className="mt-4">
                Continue to Next Topic
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
