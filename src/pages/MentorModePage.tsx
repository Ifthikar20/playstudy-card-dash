import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/appStore";
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
  Mic
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

  const session = sessionId
    ? studySessions.find(s => s.id === sessionId) || currentSession
    : currentSession;

  useEffect(() => {
    if (!session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  if (!session) {
    return null;
  }

  const topics = session.extractedTopics || [];
  const currentTopic = topics[currentTopicIndex];

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
    } else {
      setIsPlaying(true);
      if (currentTopic && !isReading) {
        speakContent(currentTopic);
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    }
  };

  const speakContent = (topic: any) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in your browser');
      return;
    }

    setIsReading(true);

    // Create narrative from topic
    const narrative = `
      Welcome to ${topic.title}.
      ${topic.description}

      Let's explore this topic together. I'll guide you through the key concepts and help you understand the material.

      ${topic.questions.map((q: any, idx: number) => `
        Question ${idx + 1}: ${q.question}

        The answer is: ${q.options[q.correctAnswer]}.

        ${q.explanation}
      `).join('\n\n')}

      That covers ${topic.title}. Let's move on when you're ready!
    `;

    const utterance = new SpeechSynthesisUtterance(narrative);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = isMuted ? 0 : 1;

    utterance.onend = () => {
      setIsReading(false);
      setIsPlaying(false);
      if (currentTopicIndex < topics.length - 1) {
        setProgress(((currentTopicIndex + 1) / topics.length) * 100);
      } else {
        setProgress(100);
      }
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const handleNext = () => {
    if (currentTopicIndex < topics.length - 1) {
      window.speechSynthesis.cancel();
      setCurrentTopicIndex(currentTopicIndex + 1);
      setIsPlaying(false);
      setIsReading(false);
      setProgress(((currentTopicIndex + 1) / topics.length) * 100);
    }
  };

  const handlePrevious = () => {
    if (currentTopicIndex > 0) {
      window.speechSynthesis.cancel();
      setCurrentTopicIndex(currentTopicIndex - 1);
      setIsPlaying(false);
      setIsReading(false);
      setProgress(((currentTopicIndex - 1) / topics.length) * 100);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if ('speechSynthesis' in window && isReading) {
      const utterances = window.speechSynthesis.getVoices();
      // Volume will be applied on next play
    }
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
                className="w-16 h-16 rounded-full"
                onClick={handlePlayPause}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
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
              {isPlaying ? 'Playing narration...' : 'Click play to start the lesson'}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
