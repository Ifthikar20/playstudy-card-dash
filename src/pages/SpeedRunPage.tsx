import { useState } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Upload, FileText, Send, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
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

export default function SpeedRunPage() {
  const { topic } = useParams();
  const [studyMaterial, setStudyMaterial] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [speedRunStarted, setSpeedRunStarted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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
    if (index === sampleQuestions[currentQuestion].correctAnswer) {
      setCorrectCount(correctCount + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < sampleQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(null);
      setHasAnswered(false);
    }
  };

  const getOptionStyle = (index: number) => {
    if (!hasAnswered) {
      return selectedAnswer === index
        ? "border-primary bg-primary/10"
        : "border-border hover:border-primary/50 hover:bg-accent/50";
    }
    
    const isCorrect = index === sampleQuestions[currentQuestion].correctAnswer;
    const isSelected = index === selectedAnswer;
    
    if (isCorrect) {
      return "border-green-500 bg-green-100 dark:bg-green-900/30";
    }
    if (isSelected && !isCorrect) {
      return "border-red-500 bg-red-100 dark:bg-red-900/30";
    }
    return "border-border opacity-50";
  };

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
                  Study Material - {topic}
                </h2>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="hidden lg:block p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <ChevronLeft size={20} className="text-muted-foreground" />
                </button>
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
                    <Upload size={24} className="mx-auto text-muted-foreground mb-2 lg:w-8 lg:h-8" />
                    <p className="text-sm lg:text-base text-muted-foreground">Click to upload study material</p>
                    <p className="text-xs lg:text-sm text-muted-foreground/60">PDF, DOC, TXT files</p>
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
                    className="w-full h-32 lg:h-64 px-3 py-2 border border-border bg-background text-foreground rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm lg:text-base"
                  />
                </div>

                <button
                  onClick={() => setSpeedRunStarted(true)}
                  disabled={!studyMaterial.trim()}
                  className="w-full flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-colors text-sm lg:text-base"
                >
                  <Send size={16} className="mr-2 lg:w-5 lg:h-5" />
                  Generate Speed Run
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Panel - MCQ Questions */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col relative">
          {!speedRunStarted ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText size={48} className="mx-auto text-muted-foreground mb-4 lg:w-16 lg:h-16" />
                <h3 className="text-lg lg:text-xl font-semibold text-foreground mb-2">
                  Upload Study Material to Start Speed Run
                </h3>
                <p className="text-sm lg:text-base text-muted-foreground">
                  Add your study content and we'll generate MCQ questions for you
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto w-full h-full flex flex-col justify-center">
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">
                    Question {currentQuestion + 1} of {sampleQuestions.length}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    Score: {correctCount}/{currentQuestion + (hasAnswered ? 1 : 0)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestion + 1) / sampleQuestions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Card */}
              <div className="bg-card rounded-xl border border-border p-6 lg:p-8 mb-6 shadow-sm">
                <h3 className="text-lg lg:text-xl font-semibold text-foreground mb-6">
                  {sampleQuestions[currentQuestion]?.question}
                </h3>

                {/* Options */}
                <div className="space-y-3">
                  {sampleQuestions[currentQuestion]?.options.map((option, index) => (
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
                      {hasAnswered && index === sampleQuestions[currentQuestion].correctAnswer && (
                        <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                      )}
                      {hasAnswered && index === selectedAnswer && index !== sampleQuestions[currentQuestion].correctAnswer && (
                        <XCircle className="text-red-600 dark:text-red-400" size={20} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <button
                  onClick={prevQuestion}
                  disabled={currentQuestion === 0}
                  className="flex items-center px-4 lg:px-6 py-3 bg-muted text-muted-foreground rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={20} className="mr-2" />
                  Previous
                </button>

                <button
                  onClick={nextQuestion}
                  disabled={currentQuestion === sampleQuestions.length - 1 || !hasAnswered}
                  className="flex items-center px-4 lg:px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ArrowRight size={20} className="ml-2" />
                </button>
              </div>

              {/* Navigation hint */}
              <div className="text-center mt-4">
                <p className="text-xs text-muted-foreground">
                  Select an answer to continue
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}