
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { AccuracyMeter } from "@/components/AccuracyMeter";
import { Upload, FileText, Send } from "lucide-react";

const sampleQuestions = [
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correct: 2
  },
  {
    question: "Which planet is closest to the Sun?",
    options: ["Venus", "Mercury", "Earth", "Mars"],
    correct: 1
  },
  {
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correct: 1
  }
];

export default function QuizPage() {
  const { topic } = useParams();
  const [studyMaterial, setStudyMaterial] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [accuracy, setAccuracy] = useState(100);
  const [quizStarted, setQuizStarted] = useState(false);

  useEffect(() => {
    // Calculate accuracy based on answers
    if (answers.length > 0) {
      const correct = answers.filter((answer, index) => answer === sampleQuestions[index]?.correct).length;
      const newAccuracy = Math.round((correct / answers.length) * 100);
      setAccuracy(newAccuracy);
    }
  }, [answers]);

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);
    
    // Move to next question after a short delay
    setTimeout(() => {
      if (currentQuestion < sampleQuestions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      }
    }, 1000);
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <div className="airbnb-container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Study Material Upload */}
          <div className="airbnb-card border border-border p-6">
            <h2 className="font-heading text-xl font-semibold text-foreground mb-4">
              Study Material - {topic}
            </h2>
            
            <div className="space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".txt,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload size={32} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-foreground text-sm">Click to upload study material</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, TXT files</p>
                </label>
              </div>

              {/* Text Area */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Or paste your content here:
                </label>
                <textarea
                  value={studyMaterial}
                  onChange={(e) => setStudyMaterial(e.target.value)}
                  placeholder="Paste your study material here..."
                  className="w-full h-64 px-3 py-2 border-2 border-border rounded-xl resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-foreground"
                />
              </div>

              <button
                onClick={() => setQuizStarted(true)}
                disabled={!studyMaterial.trim()}
                className="airbnb-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                Generate Quiz
              </button>
            </div>
          </div>

          {/* Center Panel - Quiz */}
          <div className="lg:col-span-1">
            {!quizStarted ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <FileText size={64} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-heading text-xl font-semibold text-foreground mb-2">
                    Upload Study Material to Start
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Add your study content and we'll generate a competitive quiz for you
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <div className="airbnb-card border border-border p-8">
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-muted-foreground">
                        Question {currentQuestion + 1} of {sampleQuestions.length}
                      </span>
                      <div className="w-32 airbnb-progress">
                        <div
                          className="airbnb-progress-bar transition-all duration-300"
                          style={{ width: `${((currentQuestion + 1) / sampleQuestions.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    <h3 className="font-heading text-xl font-semibold text-foreground mb-6">
                      {sampleQuestions[currentQuestion]?.question}
                    </h3>
                    
                    <div className="space-y-3">
                      {sampleQuestions[currentQuestion]?.options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleAnswerSelect(index)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            answers[currentQuestion] === index
                              ? answers[currentQuestion] === sampleQuestions[currentQuestion].correct
                                ? "bg-green-50 dark:bg-green-950/20 border-green-500 text-green-700 dark:text-green-400"
                                : "bg-red-50 dark:bg-red-950/20 border-red-500 text-red-700 dark:text-red-400"
                              : "border-border hover:border-primary/40 hover:bg-accent"
                          }`}
                          disabled={answers[currentQuestion] !== undefined}
                        >
                          <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Accuracy Meter */}
          <div>
            <AccuracyMeter accuracy={accuracy} />
          </div>
        </div>
      </div>
    </div>
  );
}
