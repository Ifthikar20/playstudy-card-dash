import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/appStore";
import { aiVoiceService, TTSProvider } from "@/services/aiVoice";
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
  MessageSquare
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

    try {
      // Get AI-generated content from DeepSeek
      const token = localStorage.getItem('auth_token');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

      console.log('[Mentor Mode] Requesting AI-generated content from DeepSeek...');
      console.log('[Mentor Mode] Topic data:', {
        id: topic.id,
        db_id: topic.db_id,
        title: topic.title,
        description: topic.description,
        questionsCount: topic.questions?.length || 0
      });

      // Only use db_id if it's a valid number (not string like "category-1")
      const topicDbId = typeof topic.db_id === 'number' ? topic.db_id : null;

      const requestBody = {
        topic_id: topicDbId,  // Use database ID only if it's a number
        topic_title: topic.title || 'Untitled Topic',
        topic_description: topic.description || null,
        questions: Array.isArray(topic.questions) ? topic.questions : [],
      };

      console.log('[Mentor Mode] Request body:', requestBody);

      const response = await fetch(`${apiUrl}/tts/generate-mentor-content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to generate AI content' }));
        const errorMessage = typeof errorData.detail === 'string'
          ? errorData.detail
          : JSON.stringify(errorData, null, 2);
        console.error('[Mentor Mode] API Error Response:', errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const narrative = data.narrative;

      console.log(`[Mentor Mode] ✅ Received AI content: ${data.estimated_duration_seconds}s estimated`);

      setFullNarrative(narrative);
      setCurrentTranscript('');

    // Simulate live transcript
    const words = narrative.split(' ');
    let wordIndex = 0;
    let transcriptInterval: NodeJS.Timeout;

      const startTranscript = () => {
        transcriptInterval = setInterval(() => {
          if (wordIndex < words.length) {
            setCurrentTranscript(prev => {
              const newText = prev + (prev ? ' ' : '') + words[wordIndex];
              wordIndex++;
              return newText;
            });
          } else {
            clearInterval(transcriptInterval);
          }
        }, 350); // Synced with OpenAI TTS speed (~170 words/minute)
      };

    const handleEnd = () => {
      if (transcriptInterval) clearInterval(transcriptInterval);
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
      if (transcriptInterval) clearInterval(transcriptInterval);
      console.error('[TTS Error]:', error);
      setError(`Unable to play audio: ${error.message}`);
      setIsReading(false);
      setIsPlaying(false);
      setIsLoading(false);
    };

    try {
      setIsLoading(true);

      // Start transcript animation slightly before audio starts
      setTimeout(startTranscript, 500);

      await aiVoiceService.speak(
        narrative,
        {
          voice: currentVoice,
          speed: 1.0, // Normal speed for natural conversation
          model: currentProvider === 'openai' ? 'tts-1' : undefined, // Fast, high-quality OpenAI model
          pitch: 0,
          provider: currentProvider
        },
        {
          onEnd: handleEnd,
          onError: handleError
        }
      );
        setIsLoading(false);
      } catch (aiError) {
        console.error('[Mentor Mode] Failed to get AI content:', aiError);
        const errorMessage = aiError instanceof Error ? aiError.message : 'Failed to generate lesson content';

        // Check for specific error types
        if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
          setError('⚙️ API keys not configured. Please add DEEPSEEK_API_KEY and OPENAI_API_KEY to backend/.env file.');
        } else if (errorMessage.includes('timeout')) {
          setError('⏱️ Request timed out. The AI is taking too long. Please try again.');
        } else {
          setError(`❌ ${errorMessage}`);
        }

        setIsReading(false);
        setIsPlaying(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[Mentor Mode] Error in speakContent:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(`⚠️ ${errorMessage}`);
      setIsReading(false);
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentTopicIndex < topics.length - 1) {
      aiVoiceService.stop();
      setCurrentTopicIndex(currentTopicIndex + 1);
      setIsPlaying(false);
      setIsReading(false);
      setCurrentTranscript('');
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
      setProgress(((currentTopicIndex - 1) / topics.length) * 100);
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    aiVoiceService.setVolume(newMutedState ? 0 : 1);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="p-4 md:p-6 border-b">
          <Button
            variant="ghost"
            className="mb-2"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Mic className="text-primary" size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">
                  AI Mentor Session
                </h1>
                <p className="text-sm text-muted-foreground">{session.title}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                Topic {currentTopicIndex + 1} / {topics.length}
              </div>
              <div className="text-xs font-medium text-foreground">
                {Math.round(progress)}% Complete
              </div>
            </div>
          </div>

          <Progress value={progress} className="h-1 mt-3" />
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
                    {currentProvider === 'openai' ? 'OpenAI' : 'Google Cloud'} • {aiVoiceService.getAvailableVoices().find(v => v.id === currentVoice)?.name || 'Default'}
                  </span>
                </summary>
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Provider</label>
                    <select
                      value={currentProvider}
                      onChange={(e) => handleProviderChange(e.target.value as TTSProvider)}
                      className="w-full text-sm border rounded px-2 py-1 mt-1 bg-background"
                    >
                      {availableProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name} {!provider.configured ? '(Not configured)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
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
                        // Format special lines with styling
                        if (line.startsWith('🎯 CONCEPT')) {
                          return <div key={index} className="font-bold text-primary text-lg mt-6 mb-3 border-l-4 border-primary pl-3">{line}</div>;
                        } else if (line.startsWith('💡 Let me explain')) {
                          return <div key={index} className="font-semibold text-blue-600 dark:text-blue-400 mt-4 mb-2">{line}</div>;
                        } else if (line.startsWith('✅ KEY ANSWER:')) {
                          return <div key={index} className="font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950 p-3 rounded-lg mt-3 mb-2 border-l-4 border-green-600">{line}</div>;
                        } else if (line.startsWith('🌍 REAL-WORLD EXAMPLES:')) {
                          return <div key={index} className="font-bold text-orange-600 dark:text-orange-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('❓ WHY THIS MATTERS:')) {
                          return <div key={index} className="font-bold text-indigo-600 dark:text-indigo-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('📌 REMEMBER THIS:')) {
                          return <div key={index} className="font-bold text-purple-600 dark:text-purple-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('🎓 LESSON SUMMARY:')) {
                          return <div key={index} className="font-bold text-primary text-lg mt-6 mb-3 border-l-4 border-primary pl-3">{line}</div>;
                        } else if (line.startsWith('📚 What is')) {
                          return <div key={index} className="font-bold text-blue-600 dark:text-blue-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('Example 1:') || line.startsWith('Example 2:')) {
                          return <div key={index} className="ml-4 mt-2 text-foreground/90 italic border-l-2 border-orange-300 dark:border-orange-700 pl-3">{line}</div>;
                        } else if (line.match(/^\d+\./)) {
                          return <div key={index} className="ml-4 mt-1 font-medium">{line}</div>;
                        } else if (line.startsWith('━━━')) {
                          return <div key={index} className="border-t-2 border-primary/30 my-4"></div>;
                        } else if (line.trim() === '') {
                          return <div key={index} className="h-3"></div>;
                        } else {
                          return <div key={index} className="leading-relaxed">{line}</div>;
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
                  disabled={currentTopicIndex === topics.length - 1}
                  title="Next Topic"
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

              <div className="text-center mt-3 text-xs text-muted-foreground">
                {isLoading ? (
                  'Preparing your lesson...'
                ) : isPlaying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Speaking
                  </span>
                ) : (
                  'Ready to learn'
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
