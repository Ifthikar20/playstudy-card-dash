import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Timer, FileText, RotateCw, Settings } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Slider } from "@/components/ui/slider";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getStudySession } from "@/services/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import * as mammoth from "mammoth";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  sourceText?: string;  // Source text snippet from document
  sourcePage?: number;  // Page number in source document
}

export default function SpeedRunPage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const currentSession = useAppStore(state => state.currentSession);
  const setCurrentSession = useAppStore(state => state.setCurrentSession);
  const studySessions = useAppStore(state => state.studySessions);
  const speedRunMode = useAppStore(state => state.speedRunMode);
  const setSpeedRunMode = useAppStore(state => state.setSpeedRunMode);
  const addXp = useAppStore(state => state.addXp);
  const answerQuestion = useAppStore(state => state.answerQuestion);

  // Session loading state
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingMoreQuestions, setIsLoadingMoreQuestions] = useState(false);
  const [previousQuestionCount, setPreviousQuestionCount] = useState(0);

  // Document viewing state
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [visiblePagesStart, setVisiblePagesStart] = useState(1);
  const PAGES_PER_BATCH = 10; // Load 10 pages at a time

  // Question state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [timerDuration, setTimerDuration] = useState(15); // Configurable timer duration
  const [timeLeft, setTimeLeft] = useState(15);

  // Flip card state
  const [isFlipped, setIsFlipped] = useState(false);

  // Highlighting state
  const [highlightedText, setHighlightedText] = useState<string | null>(null);

  // Document rendering
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const [renderedDocHTML, setRenderedDocHTML] = useState<string>("");
  const [isRenderingDoc, setIsRenderingDoc] = useState(false);

  // Get file info
  const fileContent = currentSession?.fileContent;
  const fileType = currentSession?.fileType;

  // Helper function to recursively get all topics with questions (including sub-subtopics)
  const getAllTopicsWithQuestions = (topics: any[]): any[] => {
    const result: any[] = [];
    for (const topic of topics) {
      // If this topic has questions, include it
      if (topic.questions && topic.questions.length > 0) {
        result.push(topic);
      }
      // If this topic has subtopics, recursively get their questions
      if (topic.subtopics && topic.subtopics.length > 0) {
        result.push(...getAllTopicsWithQuestions(topic.subtopics));
      }
    }
    return result;
  };

  // Get all subtopics and their questions (including nested sub-subtopics)
  const subtopics = currentSession?.extractedTopics?.flatMap(category =>
    getAllTopicsWithQuestions(category.subtopics || [])
  ) || [];

  // For now, show all questions (we'll implement page-specific filtering later)
  const allQuestions = subtopics.flatMap(topic => topic.questions || []);
  const currentQuestion = allQuestions[currentQuestionIndex];

  // Get questions for current page (temporary - using all questions for now)
  const currentPageQuestions = allQuestions;

  // Load session data based on URL parameter
  useEffect(() => {
    const loadSession = async () => {
      // If sessionId is in URL, load that session
      if (sessionId) {
        console.log('📥 [SpeedRun] URL sessionId detected:', sessionId);

        // Check if we already have this session in the store
        const existingSession = studySessions.find(s => s.id === sessionId);

        // If currentSession doesn't match URL, update it
        if (!currentSession || currentSession.id !== sessionId) {
          if (existingSession) {
            console.log('📂 [SpeedRun] Setting session from store:', sessionId);
            setCurrentSession(existingSession);
          }
        }

        // Load full session data if not already loaded or if extractedTopics is missing
        if (!currentSession?.extractedTopics || currentSession.extractedTopics.length === 0 || currentSession.id !== sessionId) {
          console.log('📥 [SpeedRun] Loading session data from backend:', sessionId);
          setIsLoadingSession(true);

          try {
            const fullSession = await getStudySession(sessionId);
            console.log('✅ [SpeedRun] Session data loaded:', fullSession);

            // Update the current session with the full data
            setCurrentSession(fullSession);
          } catch (error: any) {
            console.error('❌ [SpeedRun] Failed to load session:', error);
            // If loading fails, show error (handled by the UI below)
          } finally {
            setIsLoadingSession(false);
          }
        }
      }
    };

    loadSession();
  }, [sessionId, currentSession?.id, studySessions, setCurrentSession]);

  // Poll for new questions being loaded in the background
  useEffect(() => {
    if (!sessionId || !currentSession) return;

    const checkForNewQuestions = async () => {
      try {
        console.log(`🔍 Polling for new questions... Current: ${allQuestions.length}, At index: ${currentQuestionIndex + 1}`);
        const updatedSession = await getStudySession(sessionId);

        // Count current questions
        const currentCount = allQuestions.length;
        const updatedTopics = updatedSession.extractedTopics?.flatMap(category =>
          getAllTopicsWithQuestions(category.subtopics || [])
        ) || [];
        const updatedCount = updatedTopics.flatMap(topic => topic.questions || []).length;

        console.log(`📊 Poll result: ${currentCount} -> ${updatedCount} questions`);

        // If question count increased, update the session
        if (updatedCount > currentCount) {
          console.log(`✅ New questions loaded! Updating ${currentCount} -> ${updatedCount}`);
          setCurrentSession(updatedSession);
          setPreviousQuestionCount(currentCount);

          // Check if there are still subtopics without questions
          const hasSubtopicsWithoutQuestions = updatedTopics.some(t => !t.questions || t.questions.length === 0);
          console.log(`🔄 Still loading more? ${hasSubtopicsWithoutQuestions}`);
          setIsLoadingMoreQuestions(hasSubtopicsWithoutQuestions);
        }
      } catch (error) {
        console.error('❌ Error checking for new questions:', error);
      }
    };

    // More aggressive polling when at the max question - every 2 seconds
    // Regular polling when near the end - every 4 seconds
    const isAtMax = currentQuestionIndex >= allQuestions.length - 1;
    const isNearEnd = currentQuestionIndex >= allQuestions.length - 5;
    const shouldPoll = (isAtMax || isNearEnd) && isLoadingMoreQuestions;

    if (shouldPoll) {
      const pollInterval = isAtMax ? 2000 : 4000;
      console.log(`⏱️ Starting polling (every ${pollInterval}ms) - At max: ${isAtMax}, Loading: ${isLoadingMoreQuestions}`);
      const interval = setInterval(checkForNewQuestions, pollInterval);
      return () => {
        console.log('🛑 Stopping polling');
        clearInterval(interval);
      };
    }
  }, [sessionId, currentSession, currentQuestionIndex, allQuestions.length, isLoadingMoreQuestions]);

  // Track when question count changes to detect new questions being loaded
  useEffect(() => {
    if (allQuestions.length > 0 && previousQuestionCount === 0) {
      setPreviousQuestionCount(allQuestions.length);
    } else if (allQuestions.length > previousQuestionCount && previousQuestionCount > 0) {
      setPreviousQuestionCount(allQuestions.length);
    }
  }, [allQuestions.length, previousQuestionCount]);

  // Detect if we're at the max and should show loading indicator
  useEffect(() => {
    if (!currentSession?.extractedTopics) return;

    const allTopics = currentSession.extractedTopics.flatMap(category =>
      getAllTopicsWithQuestions(category.subtopics || [])
    );
    const hasSubtopicsWithoutQuestions = allTopics.some(topic => !topic.questions || topic.questions.length === 0);

    console.log(`🎯 Loading state check:`, {
      totalSubtopics: subtopics.length,
      subtopicsWithoutQuestions: subtopics.filter(t => !t.questions || t.questions.length === 0).length,
      totalQuestions: allQuestions.length,
      isLoadingMoreQuestions: hasSubtopicsWithoutQuestions,
      currentQuestionIndex: currentQuestionIndex + 1
    });

    setIsLoadingMoreQuestions(hasSubtopicsWithoutQuestions);
  }, [currentSession?.extractedTopics, allQuestions.length, currentQuestionIndex]);

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

  // Update highlighted text and scroll to source page when question changes or is answered
  useEffect(() => {
    if (hasAnswered && currentQuestion?.sourceText) {
      setHighlightedText(currentQuestion.sourceText);

      // Auto-scroll to the page where the answer is found
      if (currentQuestion.sourcePage && fileType === 'pdf') {
        setCurrentPageNumber(currentQuestion.sourcePage);
        // Also update visible pages to ensure the page is loaded
        setVisiblePagesStart(Math.max(1, currentQuestion.sourcePage - 2));

        // Smooth scroll to top of document viewer after a brief delay
        setTimeout(() => {
          const documentViewer = document.querySelector('.h-full.overflow-y-auto.p-6.bg-muted\\/20');
          if (documentViewer) {
            documentViewer.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 100);
      }
    } else {
      setHighlightedText(null);
    }
  }, [currentQuestionIndex, hasAnswered, currentQuestion?.sourceText, currentQuestion?.sourcePage, fileType]);

  // Render Word documents when loaded
  useEffect(() => {
    const renderWordDocument = async () => {
      if (!fileContent || !fileType) return;

      if (['docx', 'doc'].includes(fileType.toLowerCase())) {
        setIsRenderingDoc(true);
        try {
          // Convert base64 to array buffer
          const binaryString = atob(fileContent);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Use mammoth to convert to HTML
          const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
          setRenderedDocHTML(result.value);
        } catch (error) {
          console.error('Error rendering Word document:', error);
          setRenderedDocHTML("");
        } finally {
          setIsRenderingDoc(false);
        }
      }
    };

    renderWordDocument();
  }, [fileContent, fileType]);

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
    setTimeLeft(timerDuration);
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

  // Function to highlight text in study content
  const getHighlightedContent = () => {
    if (!currentSession?.studyContent || !highlightedText) {
      return currentSession?.studyContent || "No content available";
    }

    const content = currentSession.studyContent;
    const searchText = highlightedText.trim();

    // Find the text (case-insensitive)
    const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

    // Split by the search text and wrap matches in highlight spans
    const parts = content.split(regex);

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <mark
            key={index}
            className="bg-yellow-300 dark:bg-yellow-600/60 text-yellow-900 dark:text-yellow-100 px-2 py-1 rounded font-semibold animate-pulse"
            style={{ animationDuration: '2s', animationIterationCount: '3' }}
          >
            {part}
          </mark>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Function to highlight text in HTML content
  const getHighlightedHTML = (html: string) => {
    if (!highlightedText) return html;

    const searchText = highlightedText.trim();
    const regex = new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

    return html.replace(regex, '<mark style="background-color: #fde047; color: #713f12; padding: 4px 8px; border-radius: 4px; font-weight: 600; animation: highlight-pulse 2s ease-in-out 3;">$1</mark>');
  };

  // Show loading state while fetching session
  if (isLoadingSession) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Loading speedrun session..." size="lg" />
        </div>
      </div>
    );
  }

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
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-medium text-primary">
                      {(() => {
                        const categories = currentSession?.extractedTopics || [];
                        if (categories.length === 0) return 'No topics';
                        if (categories.length === 1) return categories[0].title;
                        return `${categories[0].title} + ${categories.length - 1} more`;
                      })()}
                    </p>
                    <span className="text-sm text-muted-foreground">•</span>
                    <p className="text-sm text-muted-foreground">
                      {fileType?.toUpperCase()} Document
                    </p>
                  </div>
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
                    {hasAnswered && currentQuestion?.sourcePage && currentPageNumber === currentQuestion.sourcePage && (
                      <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 font-semibold animate-pulse">
                        📍 Answer found here
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Document Display */}
              <Card>
                <CardContent className="p-6">
                  {fileType === 'pdf' ? (
                    <div className="flex flex-col items-center relative w-full">
                      {/* Add custom CSS for PDF text highlighting */}
                      {highlightedText && (
                        <style>{`
                          .react-pdf__Page__textContent mark {
                            background-color: #fde047 !important;
                            color: #713f12 !important;
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-weight: 600;
                            animation: highlight-pulse 2s ease-in-out 3;
                          }
                          @keyframes highlight-pulse {
                            0%, 100% { background-color: #fde047; }
                            50% { background-color: #fbbf24; }
                          }
                        `}</style>
                      )}

                      {/* Zoom controls at top */}
                      <div className="mb-4 flex gap-2">
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

                      {/* Scrollable container for multiple pages */}
                      <div className="w-full max-h-[70vh] overflow-y-auto space-y-4">
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
                          {/* Render pages in batches */}
                          {Array.from({ length: Math.min(numPages, visiblePagesStart + PAGES_PER_BATCH - 1) - visiblePagesStart + 1 }, (_, index) => {
                            const pageNum = visiblePagesStart + index;
                            if (pageNum > numPages) return null;
                            return (
                              <div key={pageNum} className="flex flex-col items-center border-b pb-4 last:border-b-0">
                                <div className="text-sm text-muted-foreground mb-2 font-medium">
                                  Page {pageNum} of {numPages}
                                </div>
                                <Page
                                  pageNumber={pageNum}
                                  scale={pdfScale}
                                  renderTextLayer={true}
                                  renderAnnotationLayer={true}
                                  customTextRenderer={(textItem) => {
                                    // Highlight matching text in PDF
                                    if (highlightedText && textItem.str.includes(highlightedText)) {
                                      return `<mark>${textItem.str}</mark>`;
                                    }
                                    return textItem.str;
                                  }}
                                />
                              </div>
                            );
                          })}
                        </Document>

                        {/* Load More Button */}
                        {numPages > visiblePagesStart + PAGES_PER_BATCH - 1 && (
                          <div className="text-center py-4">
                            <Button
                              onClick={() => setVisiblePagesStart(prev => prev + PAGES_PER_BATCH)}
                              variant="outline"
                            >
                              Load Next {Math.min(PAGES_PER_BATCH, numPages - (visiblePagesStart + PAGES_PER_BATCH - 1))} Pages
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : fileType && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(fileType.toLowerCase()) ? (
                    // For image files, display the image
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={`data:image/${fileType};base64,${fileContent}`}
                        alt="Study material"
                        className="max-w-full h-auto rounded-lg shadow-lg"
                        style={{ maxHeight: '70vh' }}
                      />
                      {highlightedText && (
                        <div className="w-full p-3 bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500 rounded">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <mark className="bg-yellow-300 dark:bg-yellow-600/60 px-2 py-1 rounded font-semibold">
                              {highlightedText}
                            </mark>
                          </p>
                        </div>
                      )}
                    </div>
                  ) : fileType && ['docx', 'doc'].includes(fileType.toLowerCase()) ? (
                    // For Word documents, show rendered HTML with full formatting
                    <div className="w-full">
                      {isRenderingDoc ? (
                        <div className="flex items-center justify-center p-8">
                          <RotateCw className="h-8 w-8 animate-spin text-primary" />
                          <span className="ml-2 text-muted-foreground">Rendering document...</span>
                        </div>
                      ) : renderedDocHTML ? (
                        <div className="max-h-[70vh] overflow-y-auto">
                          <div
                            className="prose prose-sm max-w-none dark:prose-invert p-4"
                            dangerouslySetInnerHTML={{ __html: getHighlightedHTML(renderedDocHTML) }}
                          />
                        </div>
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <div className="font-mono text-sm" style={{ whiteSpace: 'pre-wrap', tabSize: 4, wordBreak: 'break-word' }}>
                            {getHighlightedContent()}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : fileType && ['pptx', 'ppt'].includes(fileType.toLowerCase()) ? (
                    // For PowerPoint, show extracted content (TODO: Add slide-by-slide rendering)
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500 rounded text-sm text-orange-800 dark:text-orange-200">
                        <p className="font-medium mb-1">📊 PowerPoint Presentation</p>
                        <p className="text-xs opacity-80">Showing extracted content. Slide-by-slide view coming soon!</p>
                      </div>
                      <div className="font-mono text-sm" style={{ whiteSpace: 'pre-wrap', tabSize: 4, wordBreak: 'break-word' }}>
                        {getHighlightedContent()}
                      </div>
                    </div>
                  ) : (
                    // For other text files, show extracted content with highlighting
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="font-mono text-sm" style={{ whiteSpace: 'pre-wrap', tabSize: 4, wordBreak: 'break-word' }}>
                        {getHighlightedContent()}
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
              <div className="flex gap-2 p-1 bg-muted rounded-lg mb-4">
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

              {/* Timer Duration Control - Only show in MCQ mode */}
              {speedRunMode === 'mcq' && (
                <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Timer Duration</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{timerDuration}s</span>
                  </div>
                  <Slider
                    value={[timerDuration]}
                    onValueChange={(value) => {
                      setTimerDuration(value[0]);
                      if (!hasAnswered) {
                        setTimeLeft(value[0]);
                      }
                    }}
                    min={5}
                    max={60}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>5s</span>
                    <span>30s</span>
                    <span>60s</span>
                  </div>
                </div>
              )}

              {currentQuestion ? (
                <>
                  {/* Question Header */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Question {currentQuestionIndex + 1} / {allQuestions.length}
                        </span>
                        {isLoadingMoreQuestions && (
                          <div className="flex items-center gap-1 text-xs text-primary animate-pulse">
                            <RotateCw className="h-3 w-3 animate-spin" />
                            <span>Loading more...</span>
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-primary">
                        Correct: {correctCount} / {currentQuestionIndex + (hasAnswered ? 1 : 0)}
                      </span>
                    </div>

                    {/* Show prominent message when AT the max question count */}
                    {isLoadingMoreQuestions && currentQuestionIndex >= allQuestions.length - 1 && (
                      <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-400 dark:border-blue-600 rounded-lg shadow-sm">
                        <div className="flex items-start gap-3">
                          <RotateCw className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                              📚 Generating More Questions...
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              You've reached question {allQuestions.length}, but more are being generated! The count will update automatically (e.g., {allQuestions.length}/{allQuestions.length} → {allQuestions.length}/{allQuestions.length + 19} → {allQuestions.length + 19}/{allQuestions.length + 46}).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show subtle message when near the end but not at max */}
                    {isLoadingMoreQuestions && currentQuestionIndex < allQuestions.length - 1 && currentQuestionIndex >= allQuestions.length - 5 && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          💡 More questions are being generated in the background. Keep going!
                        </p>
                      </div>
                    )}
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
                              strokeDashoffset={`${2 * Math.PI * 36 * (1 - timeLeft / timerDuration)}`}
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

                          {/* Explanation and Source Text */}
                          {hasAnswered && (
                            <div className="mt-6 space-y-3">
                              <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm font-semibold mb-2">Explanation:</p>
                                <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                              </div>
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
                            <CardContent className="p-8 h-full flex flex-col items-center justify-center text-white overflow-y-auto">
                              <h3 className="text-xl font-semibold text-center mb-4">
                                {currentQuestion.options[currentQuestion.correctAnswer]}
                              </h3>
                              <p className="text-sm opacity-90 text-center mb-4">
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
                      disabled={currentQuestionIndex >= allQuestions.length - 1 && !isLoadingMoreQuestions}
                      className="flex-1"
                    >
                      {currentQuestionIndex >= allQuestions.length - 1 && isLoadingMoreQuestions ? (
                        <>
                          <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                          Loading More Questions...
                        </>
                      ) : currentQuestionIndex >= allQuestions.length - 1 ? (
                        <>
                          Finished
                          <CheckCircle2 className="h-4 w-4 ml-2" />
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-4">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-muted-foreground">No questions available</p>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Questions are still being generated for this session. Please wait a moment and refresh,
                        or if this persists, the AI may have failed to generate questions. Try creating a new session.
                      </p>
                    </div>
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
