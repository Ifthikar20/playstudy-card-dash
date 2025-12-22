import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Timer, FileText, RotateCw } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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

  // Document viewing state
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfScale, setPdfScale] = useState(1.0);

  // Question state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);

  // Flip card state
  const [isFlipped, setIsFlipped] = useState(false);

  // Get file info
  const fileContent = currentSession?.fileContent;
  const fileType = currentSession?.fileType;

  // Get all subtopics and their questions
  const subtopics = currentSession?.extractedTopics?.flatMap(category =>
    category.subtopics || []
  ) || [];

  // For now, show all questions (we'll implement page-specific filtering later)
  const allQuestions = subtopics.flatMap(topic => topic.questions || []);
  const currentQuestion = allQuestions[currentQuestionIndex];

  // Get questions for current page (temporary - using all questions for now)
  const currentPageQuestions = allQuestions;

  // Convert base64 to blob URL for PDF viewing
  const getPdfDataUrl = () => {
    if (fileType === 'pdf' && fileContent) {
      return `data:application/pdf;base64,${fileContent}`;
    }
    return null;
  };

  // Handle PDF document load success
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Timer for MCQ mode
  useEffect(() => {
    if (speedRunMode === 'mcq' && timeLeft > 0 && !hasAnswered) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !hasAnswered) {
      // Auto-submit when time runs out
      handleAnswerSelect(selectedAnswer ?? -1);
    }
  }, [speedRunMode, timeLeft, hasAnswered]);

  // Reset question state when changing questions
  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    setTimeLeft(15);
    setIsFlipped(false);
  };

  // Handle answer selection
  const handleAnswerSelect = (answerIndex: number) => {
    if (hasAnswered || !currentQuestion) return;

    setSelectedAnswer(answerIndex);
    setHasAnswered(true);

    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    if (isCorrect) {
      setCorrectCount(correctCount + 1);
      addXp(10); // Award XP for correct answer
    }

    if (currentSession) {
      answerQuestion(currentSession.id, currentQuestion.id, isCorrect);
    }
  };

  // Navigate to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      resetQuestionState();
    }
  };

  // Navigate to previous question
  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      resetQuestionState();
    }
  };

  // Navigate to next page
  const nextPage = () => {
    if (currentPageNumber < numPages) {
      setCurrentPageNumber(currentPageNumber + 1);
    }
  };

  // Navigate to previous page
  const previousPage = () => {
    if (currentPageNumber > 1) {
      setCurrentPageNumber(currentPageNumber - 1);
    }
  };

  if (!currentSession) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Session not found</p>
        </div>
      </div>
    );
  }

  if (!fileContent) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No document uploaded for this session</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Document Viewer */}
          <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
            <div className="h-full overflow-y-auto p-6 bg-muted/20">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{currentSession.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {fileType?.toUpperCase()} Document
                  </p>
                </div>

                {fileType === 'pdf' && numPages > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={previousPage}
                      disabled={currentPageNumber <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[80px] text-center">
                      Page {currentPageNumber} / {numPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={nextPage}
                      disabled={currentPageNumber >= numPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Document Display */}
              <Card>
                <CardContent className="p-6">
                  {fileType === 'pdf' ? (
                    <div className="flex flex-col items-center">
                      <Document
                        file={getPdfDataUrl()}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={
                          <div className="flex items-center justify-center p-8">
                            <RotateCw className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        }
                        error={
                          <div className="text-center p-8 text-destructive">
                            Failed to load PDF document
                          </div>
                        }
                      >
                        <Page
                          pageNumber={currentPageNumber}
                          scale={pdfScale}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                        />
                      </Document>

                      {/* Zoom controls */}
                      <div className="mt-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPdfScale(Math.max(0.5, pdfScale - 0.1))}
                        >
                          -
                        </Button>
                        <span className="text-sm px-3 py-1 bg-muted rounded flex items-center">
                          {Math.round(pdfScale * 100)}%
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPdfScale(Math.min(2.0, pdfScale + 0.1))}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // For non-PDF files, show extracted text content
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="whitespace-pre-wrap">
                        {currentSession.studyContent || "No content available"}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Page progress bar */}
              {fileType === 'pdf' && numPages > 0 && (
                <div className="mt-4">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-purple-600 transition-all"
                      style={{ width: `${(currentPageNumber / numPages) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - Questions */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto p-6">
              {/* Mode Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg mb-6">
                <button
                  onClick={() => setSpeedRunMode('cards')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    speedRunMode === 'cards'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Flip Cards
                </button>
                <button
                  onClick={() => setSpeedRunMode('mcq')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    speedRunMode === 'mcq'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Timed MCQ
                </button>
              </div>

              {currentQuestion ? (
                <>
                  {/* Question Header */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Question {currentQuestionIndex + 1} / {allQuestions.length}
                      </span>
                      <span className="text-sm font-medium text-primary">
                        Correct: {correctCount} / {currentQuestionIndex + (hasAnswered ? 1 : 0)}
                      </span>
                    </div>
                  </div>

                  {speedRunMode === 'mcq' ? (
                    /* MCQ Mode */
                    <div className="space-y-6">
                      {/* Timer */}
                      <div className="flex justify-center">
                        <div className={`relative w-20 h-20 ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              className="text-muted"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 36}`}
                              strokeDashoffset={`${2 * Math.PI * 36 * (1 - timeLeft / 15)}`}
                              className={`transition-all ${
                                timeLeft <= 5 ? 'text-destructive' : 'text-primary'
                              }`}
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-2xl font-bold ${
                              timeLeft <= 5 ? 'text-destructive' : 'text-foreground'
                            }`}>
                              {timeLeft}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Question */}
                      <Card>
                        <CardContent className="p-6">
                          <h3 className="text-lg font-semibold mb-4">{currentQuestion.question}</h3>

                          {/* Options */}
                          <div className="space-y-3">
                            {currentQuestion.options.map((option, index) => {
                              const isSelected = selectedAnswer === index;
                              const isCorrect = index === currentQuestion.correctAnswer;
                              const showResult = hasAnswered;

                              return (
                                <button
                                  key={index}
                                  onClick={() => handleAnswerSelect(index)}
                                  disabled={hasAnswered}
                                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                    showResult && isCorrect
                                      ? 'border-green-500 bg-green-500/10'
                                      : showResult && isSelected && !isCorrect
                                      ? 'border-destructive bg-destructive/10'
                                      : isSelected
                                      ? 'border-primary bg-primary/10'
                                      : 'border-border hover:border-primary/50'
                                  } ${hasAnswered ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold">
                                      {String.fromCharCode(65 + index)}
                                    </span>
                                    <span className="flex-1">{option}</span>
                                    {showResult && isCorrect && (
                                      <CheckCircle2 className="flex-shrink-0 text-green-600" size={20} />
                                    )}
                                    {showResult && isSelected && !isCorrect && (
                                      <XCircle className="flex-shrink-0 text-destructive" size={20} />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Explanation */}
                          {hasAnswered && (
                            <div className="mt-6 p-4 bg-muted rounded-lg">
                              <p className="text-sm font-semibold mb-2">Explanation:</p>
                              <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    /* Flip Cards Mode */
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="relative w-full max-w-md h-80 cursor-pointer"
                        style={{ perspective: '1000px' }}
                      >
                        <div
                          className="relative w-full h-full transition-transform duration-500"
                          style={{
                            transformStyle: 'preserve-3d',
                            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                          }}
                        >
                          {/* Front - Question */}
                          <Card
                            className="absolute w-full h-full"
                            style={{
                              backfaceVisibility: 'hidden',
                            }}
                          >
                            <CardContent className="p-8 h-full flex flex-col items-center justify-center">
                              <h3 className="text-xl font-semibold text-center mb-4">
                                {currentQuestion.question}
                              </h3>
                              <p className="text-sm text-muted-foreground text-center mt-auto">
                                Click to reveal answer
                              </p>
                            </CardContent>
                          </Card>

                          {/* Back - Answer */}
                          <Card
                            className="absolute w-full h-full bg-gradient-to-br from-primary to-purple-600"
                            style={{
                              backfaceVisibility: 'hidden',
                              transform: 'rotateY(180deg)',
                            }}
                          >
                            <CardContent className="p-8 h-full flex flex-col items-center justify-center text-white">
                              <h3 className="text-xl font-semibold text-center mb-6">
                                {currentQuestion.options[currentQuestion.correctAnswer]}
                              </h3>
                              <p className="text-sm opacity-90 text-center">
                                {currentQuestion.explanation}
                              </p>
                              <p className="text-xs opacity-75 text-center mt-auto">
                                Click to see question
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="mt-6 flex gap-3">
                    <Button
                      variant="outline"
                      onClick={previousQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="flex-1"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Previous
                    </Button>
                    <Button
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex >= allQuestions.length - 1}
                      className="flex-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">No questions available for this page</p>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
