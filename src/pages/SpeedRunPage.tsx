import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Upload, FileText, Send, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Timer, Layers, AlertCircle, PlusCircle, Zap } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface FlashCard {
  front: string;
  back: string;
}

const sampleQuestions: Question[] = [
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correctAnswer: 2
  },
  {
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctAnswer: 1
  },
  {
    question: "Who wrote Romeo and Juliet?",
    options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    correctAnswer: 1
  }
];

const sampleCards: FlashCard[] = [
  { front: "What is the capital of France?", back: "Paris" },
  { front: "What is 2 + 2?", back: "4" },
  { front: "Who wrote Romeo and Juliet?", back: "William Shakespeare" }
];

export default function SpeedRunPage() {
  const { currentSession, speedRunMode, setSpeedRunMode, addXp, createSpeedRun } = useAppStore();
  const [studyMaterial, setStudyMaterial] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [speedRunStarted, setSpeedRunStarted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);

  // Timer for MCQ mode
  useEffect(() => {
    if (speedRunStarted && speedRunMode === 'mcq' && !hasAnswered && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (timeLeft === 0 && !hasAnswered) {
      setHasAnswered(true);
    }
  }, [timeLeft, speedRunStarted, speedRunMode, hasAnswered]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setStudyMaterial(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleAnswerSelect = (index: number) => {
    if (hasAnswered) return;
    setSelectedAnswer(index);
    setHasAnswered(true);
    if (index === sampleQuestions[currentIndex].correctAnswer) {
      setCorrectCount(correctCount + 1);
      addXp(10);
    }
  };

  const nextItem = () => {
    const maxIndex = speedRunMode === 'mcq' ? sampleQuestions.length - 1 : sampleCards.length - 1;
    if (currentIndex < maxIndex) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setIsFlipped(false);
      setTimeLeft(15);
    }
  };

  const prevItem = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setIsFlipped(false);
      setTimeLeft(15);
    }
  };

  const getOptionStyle = (index: number) => {
    if (!hasAnswered) {
      return selectedAnswer === index
        ? "border-primary bg-primary/10"
        : "border-border hover:border-primary/50 hover:bg-accent/50";
    }
    
    const isCorrect = index === sampleQuestions[currentIndex].correctAnswer;
    const isSelected = index === selectedAnswer;
    
    if (isCorrect) return "border-green-500 bg-green-100 dark:bg-green-900/30";
    if (isSelected && !isCorrect) return "border-red-500 bg-red-100 dark:bg-red-900/30";
    return "border-border opacity-50";
  };

  const totalItems = speedRunMode === 'mcq' ? sampleQuestions.length : sampleCards.length;

  // No session selected
  if (!currentSession) {
    return (
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <AlertCircle size={64} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Study Session Selected</h2>
            <p className="text-muted-foreground mb-4">
              Select a study session from the sidebar to start Speed Run
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Session selected but no Speed Run created yet
  if (!currentSession.hasSpeedRun) {
    return (
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <Zap size={64} className="mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Create Speed Run for "{currentSession.title}"
            </h2>
            <p className="text-muted-foreground mb-6">
              No Speed Run exists yet. Create one to practice with timed MCQs or flip cards.
            </p>
            <Button 
              size="lg" 
              onClick={() => createSpeedRun(currentSession.id)}
              className="gap-2"
            >
              <PlusCircle size={20} />
              Create Speed Run
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar />
      
      <div className="flex-1 flex flex-col lg:flex-row overflow-auto">
        {/* Left Panel - Study Material Upload */}
        <div className={`${isMinimized ? 'w-0 lg:w-12' : 'w-full lg:w-1/3'} bg-card border-b lg:border-r lg:border-b-0 border-border transition-all duration-300 overflow-hidden`}>
          {isMinimized ? (
            <div className="hidden lg:block p-3">
              <button
                onClick={() => setIsMinimized(false)}
                className="w-full p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronRight size={20} className="mx-auto text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg lg:text-xl font-semibold text-foreground">
                  {currentSession.title}
                </h2>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="hidden lg:block p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <ChevronLeft size={20} className="text-muted-foreground" />
                </button>
              </div>

              {/* Mode Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-2">Study Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSpeedRunMode('cards')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      speedRunMode === 'cards' 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Layers size={18} />
                    <span className="text-sm font-medium">Flip Cards</span>
                  </button>
                  <button
                    onClick={() => setSpeedRunMode('mcq')}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      speedRunMode === 'mcq' 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Timer size={18} />
                    <span className="text-sm font-medium">Timed MCQ</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-4 lg:p-6 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload study material</p>
                    <p className="text-xs text-muted-foreground/60">PDF, DOC, TXT files</p>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Or paste your content here:
                  </label>
                  <textarea
                    value={studyMaterial}
                    onChange={(e) => setStudyMaterial(e.target.value)}
                    placeholder="Paste your study material here..."
                    className="w-full h-32 lg:h-48 px-3 py-2 border border-border bg-background text-foreground rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                </div>

                <button
                  onClick={() => { setSpeedRunStarted(true); setTimeLeft(15); }}
                  disabled={!studyMaterial.trim()}
                  className="w-full flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-colors"
                >
                  <Send size={16} className="mr-2" />
                  Start {speedRunMode === 'mcq' ? 'Timed MCQ' : 'Flip Cards'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Panel */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col relative">
          {!speedRunStarted ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg lg:text-xl font-semibold text-foreground mb-2">
                  Upload Study Material to Start
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose between flip cards or timed MCQ mode
                </p>
              </div>
            </div>
          ) : speedRunMode === 'mcq' ? (
            /* MCQ Mode */
            <div className="max-w-2xl mx-auto w-full h-full flex flex-col justify-center">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">
                    Question {currentIndex + 1} of {totalItems}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-bold flex items-center gap-1 ${timeLeft <= 5 ? 'text-red-500' : 'text-primary'}`}>
                      <Timer size={16} />
                      {timeLeft}s
                    </span>
                    <span className="text-sm font-medium text-primary">
                      Score: {correctCount}/{currentIndex + (hasAnswered ? 1 : 0)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / totalItems) * 100}%` }}
                  />
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6 lg:p-8 mb-6 shadow-sm">
                <h3 className="text-lg lg:text-xl font-semibold text-foreground mb-6">
                  {sampleQuestions[currentIndex]?.question}
                </h3>

                <div className="space-y-3">
                  {sampleQuestions[currentIndex]?.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={hasAnswered}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center justify-between ${getOptionStyle(index)}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-foreground">{option}</span>
                      </div>
                      {hasAnswered && index === sampleQuestions[currentIndex].correctAnswer && (
                        <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                      )}
                      {hasAnswered && index === selectedAnswer && index !== sampleQuestions[currentIndex].correctAnswer && (
                        <XCircle className="text-red-600 dark:text-red-400" size={20} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={prevItem}
                  disabled={currentIndex === 0}
                  className="flex items-center px-4 lg:px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={20} className="mr-2" />
                  Previous
                </button>

                <button
                  onClick={nextItem}
                  disabled={currentIndex === totalItems - 1 || !hasAnswered}
                  className="flex items-center px-4 lg:px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ArrowRight size={20} className="ml-2" />
                </button>
              </div>
            </div>
          ) : (
            /* Flip Cards Mode */
            <div className="max-w-2xl mx-auto w-full h-full flex flex-col justify-center">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">
                    Card {currentIndex + 1} of {totalItems}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / totalItems) * 100}%` }}
                  />
                </div>
              </div>

              <div 
                className="relative h-64 lg:h-80 mb-6 cursor-pointer perspective-1000"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div 
                  className="absolute inset-0 w-full h-full transition-transform duration-500"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                >
                  <div className="absolute inset-0 w-full h-full bg-card rounded-xl border border-border p-8 flex items-center justify-center shadow-lg"
                       style={{ backfaceVisibility: 'hidden' }}>
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-foreground mb-4">
                        {sampleCards[currentIndex]?.front}
                      </h3>
                      <p className="text-sm text-muted-foreground">Click to reveal answer</p>
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 w-full h-full bg-primary/10 rounded-xl border border-primary/20 p-8 flex items-center justify-center shadow-lg"
                       style={{ 
                         backfaceVisibility: 'hidden',
                         transform: 'rotateY(180deg)'
                       }}>
                    <div className="text-center">
                      <h3 className="text-xl font-medium text-foreground mb-4">
                        {sampleCards[currentIndex]?.back}
                      </h3>
                      <p className="text-sm text-primary">Click to go back</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={prevItem}
                  disabled={currentIndex === 0}
                  className="flex items-center px-4 lg:px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={20} className="mr-2" />
                  Previous
                </button>

                <button
                  onClick={nextItem}
                  disabled={currentIndex === totalItems - 1}
                  className="flex items-center px-4 lg:px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ArrowRight size={20} className="ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}