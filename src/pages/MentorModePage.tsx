import { useState, useEffect } from "react";
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
  User,
  BookOpen,
  ArrowLeft,
  Mic,
  Settings
} from "lucide-react";

export default function MentorModePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentSession, studySessions } = useAppStore();

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

  const session = sessionId
    ? studySessions.find(s => s.id === sessionId) || currentSession
    : currentSession;

  useEffect(() => {
    if (!session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  // Fetch providers and voices on mount
  useEffect(() => {
    const loadProvidersAndVoices = async () => {
      try {
        // Fetch available providers from backend
        const providers = await aiVoiceService.fetchProviders();
        setAvailableProviders(providers);

        // Set first configured provider as default
        const configuredProvider = providers.find(p => p.configured);
        if (configuredProvider) {
          setCurrentProvider(configuredProvider.id);
          aiVoiceService.setProvider(configuredProvider.id);

          // Fetch voices for the default provider
          const voices = await aiVoiceService.fetchVoices(configuredProvider.id);
          if (voices.length > 0) {
            setCurrentVoice(voices[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load TTS providers:', error);
        // Fallback to browser TTS
        setCurrentProvider('browser');
        aiVoiceService.setProvider('browser');
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

    // Fetch voices for the new provider
    try {
      const voices = await aiVoiceService.fetchVoices(provider);
      if (voices.length > 0) {
        setCurrentVoice(voices[0].id);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  };

  const speakContent = async (topic: any) => {
    setIsReading(true);
    setIsLoading(true);
    setError(null);

    // Create a teacher-style narrative explaining the content
    const narrative = `
Hello! I'm your AI mentor, and I'm here to help you understand ${topic.title}.

${topic.description ? `Let me explain what this topic is about. ${topic.description}` : ''}

Now, let me break this down into key concepts that you need to understand.

${topic.questions && topic.questions.length > 0 ? topic.questions.map((q: any, idx: number) => {
  const questionNumber = idx + 1;
  const correctAnswer = q.options[q.correctAnswer];

  return `
Concept ${questionNumber}: ${q.question}

${q.explanation ? `Here's what you need to know: ${q.explanation}` : ''}

The key point to remember is: ${correctAnswer}.

${q.options && q.options.length > 1 ? `
Let me explain why the other options aren't correct.
${q.options.map((opt: string, optIdx: number) => {
  if (optIdx !== q.correctAnswer) {
    return `${opt} - This is not the best answer because it doesn't fully capture the concept.`;
  }
  return '';
}).filter(Boolean).join(' ')}
` : ''}
  `;
}).join('\n\n') : 'This topic contains important concepts for you to learn.'}

That's everything you need to know about ${topic.title}.

Take a moment to think about what we've covered. When you're ready, you can move on to the next topic.

Remember, learning is a journey. Don't hesitate to replay this if you need to hear it again!
    `.trim();

    const handleEnd = () => {
      setIsReading(false);
      setIsPlaying(false);
      if (currentTopicIndex < topics.length - 1) {
        setProgress(((currentTopicIndex + 1) / topics.length) * 100);
      } else {
        setProgress(100);
      }
    };

    const handleError = (error: Error) => {
      console.error('TTS Error:', error);
      setError(`Failed to play audio: ${error.message}. Try using Browser TTS instead.`);
      setIsReading(false);
      setIsPlaying(false);
      setIsLoading(false);
    };

    try {
      setIsLoading(true);
      await aiVoiceService.speak(
        narrative,
        {
          voice: currentVoice,
          speed: 0.95, // Slightly slower for better comprehension
          model: currentProvider === 'openai' ? 'tts-1' : undefined,
          pitch: 0,
          provider: currentProvider
        },
        {
          onEnd: handleEnd,
          onError: handleError
        }
      );
      setIsLoading(false);
    } catch (error) {
      handleError(error as Error);
    }
  };

  const handleNext = () => {
    if (currentTopicIndex < topics.length - 1) {
      // Stop any playing audio
      aiVoiceService.stop();
      setCurrentTopicIndex(currentTopicIndex + 1);
      setIsPlaying(false);
      setIsReading(false);
      setProgress(((currentTopicIndex + 1) / topics.length) * 100);
    }
  };

  const handlePrevious = () => {
    if (currentTopicIndex > 0) {
      // Stop any playing audio
      aiVoiceService.stop();
      setCurrentTopicIndex(currentTopicIndex - 1);
      setIsPlaying(false);
      setIsReading(false);
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

      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft size={18} className="mr-2" />
              Back to Dashboard
            </Button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <Mic className="text-primary" size={28} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Mentor Mode
                </h1>
                <p className="text-muted-foreground">{session.title}</p>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                Topic {currentTopicIndex + 1} of {topics.length}
              </span>
              <span className="font-medium text-foreground">
                {Math.round(progress)}% Complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Voice Settings */}
          <Card className="p-4 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-primary" />
                <span className="text-sm font-medium">TTS Provider Settings</span>
              </div>

              {/* Provider Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Provider</label>
                <select
                  value={currentProvider}
                  onChange={(e) => handleProviderChange(e.target.value as TTSProvider)}
                  className="text-sm border rounded px-3 py-2 bg-background"
                >
                  {availableProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} {!provider.configured && provider.id !== 'browser' ? '(Not configured)' : ''}
                    </option>
                  ))}
                </select>

                {/* Configuration notice */}
                {!availableProviders.find(p => p.id === currentProvider)?.configured && currentProvider !== 'browser' && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ API key not configured. Add the required API key to your .env file.
                  </p>
                )}
              </div>

              {/* Voice Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Voice</label>
                <select
                  value={currentVoice}
                  onChange={(e) => setCurrentVoice(e.target.value)}
                  className="text-sm border rounded px-3 py-2 bg-background"
                >
                  {aiVoiceService.getAvailableVoices().map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} - {voice.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Error Display */}
          {error && (
            <Card className="p-4 mb-6 border-destructive bg-destructive/10">
              <div className="flex items-start gap-2">
                <span className="text-sm text-destructive">
                  ⚠️ {error}
                </span>
              </div>
            </Card>
          )}

          {/* Teacher Avatar & Content */}
          <Card className="p-6 mb-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="text-primary" size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Your AI Mentor
                </h3>
                <p className="text-sm text-muted-foreground">
                  I'll guide you through the material step by step
                </p>
              </div>
            </div>

            {currentTopic && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen size={18} className="text-primary" />
                    <h4 className="font-semibold text-foreground">
                      {currentTopic.title}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {currentTopic.description}
                  </p>
                </div>

                <div className="prose prose-sm max-w-none">
                  <h5 className="text-sm font-semibold text-foreground mb-3">
                    Key Concepts ({currentTopic.questions.length} topics to cover)
                  </h5>
                  <div className="space-y-3">
                    {currentTopic.questions.map((question: any, idx: number) => (
                      <div key={idx} className="bg-accent/50 rounded-lg p-3">
                        <p className="text-sm font-medium text-foreground mb-2">
                          {idx + 1}. {question.question}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-primary">Answer:</span>{' '}
                          {question.options[question.correctAnswer]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {question.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Controls */}
          <Card className="p-6">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                disabled={currentTopicIndex === 0}
              >
                <SkipBack size={20} />
              </Button>

              <Button
                size="lg"
                className="w-16 h-16 rounded-full relative"
                onClick={handlePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="text-xs">Loading...</span>
                ) : isPlaying ? (
                  <Pause size={24} />
                ) : (
                  <Play size={24} className="ml-1" />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={currentTopicIndex === topics.length - 1}
              >
                <SkipForward size={20} />
              </Button>

              <div className="ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </Button>
              </div>
            </div>

            <div className="text-center mt-4 text-sm text-muted-foreground">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <span>Preparing your lesson...</span>
                </div>
              ) : isPlaying ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span>Listening to your AI mentor</span>
                </div>
              ) : (
                <span className="font-medium">🎙️ Click play to start the lesson</span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
