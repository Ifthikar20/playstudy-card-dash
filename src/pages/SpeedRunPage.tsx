import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Timer, Layers, RotateCw, Zap } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export default function SpeedRunPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { currentSession, speedRunMode, setSpeedRunMode, addXp, answerQuestion } = useAppStore();

  // Current slide/topic index
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // MCQ state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);

  // Flip card state
  const [isFlipped, setIsFlipped] = useState(false);

  // Get all subtopics (slides)
  const subtopics = currentSession?.extractedTopics?.flatMap(category =>
    category.subtopics || []
  ) || [];

  const currentSlide = subtopics[currentSlideIndex];
  const currentSlideQuestions = currentSlide?.questions || [];
  const currentQuestion = currentSlideQuestions[currentQuestionIndex];

  const totalSlides = subtopics.length;
  const totalQuestionsInSlide = currentSlideQuestions.length;

  // Timer for MCQ mode
  useEffect(() => {
    if (speedRunMode === 'mcq' && !hasAnswered && timeLeft > 0 && currentQuestion) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (timeLeft === 0 && !hasAnswered) {
      setHasAnswered(true);
    }
  }, [timeLeft, speedRunMode, hasAnswered, currentQuestion]);

  const handleAnswerSelect = (index: number) => {
    if (hasAnswered || !currentQuestion) return;
    setSelectedAnswer(index);
    setHasAnswered(true);

    if (index === currentQuestion.correctAnswer) {
      setCorrectCount(correctCount + 1);
      addXp(10);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < totalQuestionsInSlide - 1) {
      // Next question in current slide
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      resetQuestionState();
    } else if (currentSlideIndex < totalSlides - 1) {
      // Next slide
      setCurrentSlideIndex(currentSlideIndex + 1);
      setCurrentQuestionIndex(0);
      resetQuestionState();
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      // Previous question in current slide
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      resetQuestionState();
    } else if (currentSlideIndex > 0) {
      // Previous slide (go to last question)
      setCurrentSlideIndex(currentSlideIndex - 1);
      const prevSlide = subtopics[currentSlideIndex - 1];
      setCurrentQuestionIndex((prevSlide?.questions?.length || 1) - 1);
      resetQuestionState();
    }
  };

  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    setIsFlipped(false);
    setTimeLeft(15);
  };

  const getOptionStyle = (index: number) => {
    if (!hasAnswered || !currentQuestion) {
      return selectedAnswer === index
        ? "border-primary bg-primary/10"
        : "border-border hover:border-primary/50 hover:bg-accent/50";
    }

    const isCorrect = index === currentQuestion.correctAnswer;
    const isSelected = index === selectedAnswer;

    if (isCorrect) return "border-green-500 bg-green-100 dark:bg-green-900/30";
    if (isSelected && !isCorrect) return "border-red-500 bg-red-100 dark:bg-red-900/30";
    return "border-border opacity-50";
  };

  // No session selected
  if (!currentSession) {
    return (
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <Zap size={64} className="mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Speed Run Mode</h2>
            <p className="text-muted-foreground mb-6">
              Select a study session from the dashboard to begin Speed Run mode.
            </p>
            <Button size="lg" onClick={() => window.location.href = '/'}>
              Go to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Session has no content
  if (!currentSession.extractedTopics || currentSession.extractedTopics.length === 0 || subtopics.length === 0) {
    return (
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <Zap size={64} className="mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              No Content Available
            </h2>
            <p className="text-muted-foreground mb-6">
              This session "{currentSession.title}" has no study content yet.
            </p>
            <Button size="lg" onClick={() => window.location.href = '/'}>
              Go to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Side - Document/Slide Viewer */}
          <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
            <div className="h-full overflow-y-auto p-6 border-r border-border bg-gradient-to-br from-background to-muted/20">
              <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold text-foreground">
                      {currentSession.title}
                    </h1>
                    <div className="text-sm text-muted-foreground font-medium">
                      Slide {currentSlideIndex + 1} / {totalSlides}
                    </div>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${((currentSlideIndex + 1) / totalSlides) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Current Slide Content */}
                {currentSlide && (
                  <Card className="bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-8">
                      <div className="mb-4">
                        <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                          {currentSlide.isCategory ? 'Category' : 'Topic'}
                        </div>
                        <h2 className="text-3xl font-bold text-foreground mb-3">
                          {currentSlide.title}
                        </h2>
                      </div>

                      {currentSlide.description && (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="text-lg text-muted-foreground leading-relaxed">
                            {currentSlide.description}
                          </p>
                        </div>
                      )}

                      {/* Questions count for this slide */}
                      <div className="mt-6 pt-6 border-t border-border">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {totalQuestionsInSlide} question{totalQuestionsInSlide !== 1 ? 's' : ''} in this topic
                          </span>
                          <span className="text-primary font-medium">
                            Question {currentQuestionIndex + 1} / {totalQuestionsInSlide}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={prevQuestion}
                    disabled={currentSlideIndex === 0 && currentQuestionIndex === 0}
                    className="gap-2"
                  >
                    <ChevronLeft size={18} />
                    Previous
                  </Button>
                  <Button
                    onClick={nextQuestion}
                    disabled={currentSlideIndex === totalSlides - 1 && currentQuestionIndex === totalQuestionsInSlide - 1}
                    className="gap-2"
                  >
                    Next
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Side - Questions */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto p-6 bg-background">
              <div className="max-w-2xl mx-auto">
                {/* Mode Toggle */}
                <div className="mb-6">
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                      onClick={() => { setSpeedRunMode('cards'); resetQuestionState(); }}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md transition-all ${
                        speedRunMode === 'cards'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Layers size={18} />
                      <span className="text-sm font-medium">Flip Cards</span>
                    </button>
                    <button
                      onClick={() => { setSpeedRunMode('mcq'); resetQuestionState(); }}
                      className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md transition-all ${
                        speedRunMode === 'mcq'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Timer size={18} />
                      <span className="text-sm font-medium">Timed MCQ</span>
                    </button>
                  </div>
                </div>

                {/* Question Display */}
                {currentQuestion ? (
                  <>
                    {speedRunMode === 'mcq' ? (
                      <div className="space-y-6">
                        {/* Timer */}
                        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                          <span className="text-sm font-medium text-foreground">Time Remaining</span>
                          <div className={`flex items-center gap-2 ${timeLeft <= 5 ? 'text-red-500' : 'text-primary'}`}>
                            <Timer size={18} />
                            <span className="text-2xl font-bold">{timeLeft}s</span>
                          </div>
                        </div>

                        {/* Question */}
                        <Card>
                          <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-foreground mb-4">
                              {currentQuestion.question}
                            </h3>

                            <div className="space-y-3">
                              {currentQuestion.options.map((option, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleAnswerSelect(index)}
                                  disabled={hasAnswered}
                                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${getOptionStyle(index)}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium">
                                      {String.fromCharCode(65 + index)}
                                    </span>
                                    <span className="flex-1 break-words">{option}</span>
                                    {hasAnswered && index === currentQuestion.correctAnswer && (
                                      <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                                    )}
                                    {hasAnswered && index === selectedAnswer && index !== currentQuestion.correctAnswer && (
                                      <XCircle className="text-red-600 flex-shrink-0" size={20} />
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>

                            {hasAnswered && (
                              <div className="mt-4 p-4 rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground">
                                  <strong>Explanation:</strong> {currentQuestion.explanation}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Flip Card */}
                        <div
                          className="relative h-80 cursor-pointer"
                          onClick={() => setIsFlipped(!isFlipped)}
                        >
                          <div className={`absolute inset-0 transition-all duration-500 transform ${isFlipped ? 'rotate-y-180' : ''}`}
                               style={{ transformStyle: 'preserve-3d' }}>
                            {/* Front */}
                            <Card className={`absolute inset-0 ${isFlipped ? 'invisible' : 'visible'}`}
                                  style={{ backfaceVisibility: 'hidden' }}>
                              <CardContent className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-primary/5 to-primary/10">
                                <div className="text-xs font-medium text-primary mb-4">QUESTION</div>
                                <h3 className="text-xl font-semibold text-foreground text-center">
                                  {currentQuestion.question}
                                </h3>
                                <div className="mt-8 text-sm text-muted-foreground flex items-center gap-2">
                                  <RotateCw size={16} />
                                  Click to reveal answer
                                </div>
                              </CardContent>
                            </Card>

                            {/* Back */}
                            <Card className={`absolute inset-0 ${isFlipped ? 'visible' : 'invisible'}`}
                                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                              <CardContent className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-green-500/5 to-green-500/10">
                                <div className="text-xs font-medium text-green-600 mb-4">ANSWER</div>
                                <h3 className="text-xl font-semibold text-foreground text-center mb-4">
                                  {currentQuestion.options[currentQuestion.correctAnswer]}
                                </h3>
                                <p className="text-sm text-muted-foreground text-center">
                                  {currentQuestion.explanation}
                                </p>
                                <div className="mt-8 text-sm text-muted-foreground flex items-center gap-2">
                                  <RotateCw size={16} />
                                  Click to flip back
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>

                        <p className="text-center text-sm text-muted-foreground">
                          Click the card to flip between question and answer
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No questions available for this slide</p>
                  </div>
                )}

                {/* Stats */}
                <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Correct Answers</span>
                    <span className="font-semibold text-foreground">{correctCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
