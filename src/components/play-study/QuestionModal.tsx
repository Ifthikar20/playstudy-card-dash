import { useState, useEffect } from "react";
import { X, Lightbulb, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  hint?: string;
}

interface QuestionModalProps {
  question: Question;
  timeLimit: number;
  onAnswer: (correct: boolean, timeLeft: number) => void;
  onHintUsed: () => void;
  hintCost: number;
  isOpen: boolean;
}

export function QuestionModal({
  question,
  timeLimit,
  onAnswer,
  onHintUsed,
  hintCost,
  isOpen,
}: QuestionModalProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(timeLimit);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowHint(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          handleAnswer(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLimit]);

  const handleAnswer = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);

    const isCorrect = index === question.correctIndex;
    setTimeout(() => {
      onAnswer(isCorrect, timeLeft);
    }, 1500);
  };

  const handleHint = () => {
    setShowHint(true);
    onHintUsed();
  };

  if (!isOpen) return null;

  const timePercentage = (timeLeft / timeLimit) * 100;
  const isCorrect = selectedAnswer === question.correctIndex;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-xl w-full max-w-[90%] sm:max-w-lg shadow-2xl animate-slide-up">
        {/* Timer Bar */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Time Remaining
            </span>
            <span
              className={cn(
                "text-sm font-bold",
                timeLeft <= 5 ? "text-destructive" : "text-foreground"
              )}
            >
              {timeLeft}s
            </span>
          </div>
          <Progress
            value={timePercentage}
            className={cn(
              "h-2 transition-all",
              timeLeft <= 5 ? "[&>div]:bg-destructive" : "[&>div]:gradient-primary"
            )}
          />
        </div>

        {/* Question */}
        <div className="p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold mb-6 text-center">
            {question.question}
          </h3>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrectOption = index === question.correctIndex;
              const showCorrect = showResult && isCorrectOption;
              const showWrong = showResult && isSelected && !isCorrectOption;

              return (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => handleAnswer(index)}
                  disabled={showResult}
                  className={cn(
                    "h-auto py-4 px-4 text-left justify-start text-sm sm:text-base whitespace-normal min-h-[56px]",
                    showCorrect && "border-success bg-success/10 text-success",
                    showWrong && "border-destructive bg-destructive/10 text-destructive",
                    !showResult && "hover:border-primary hover:bg-primary/5"
                  )}
                >
                  <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                  {option}
                  {showCorrect && <CheckCircle2 className="ml-auto h-5 w-5 flex-shrink-0" />}
                  {showWrong && <XCircle className="ml-auto h-5 w-5 flex-shrink-0" />}
                </Button>
              );
            })}
          </div>

          {/* Hint */}
          {question.hint && !showResult && (
            <div className="mt-6 text-center">
              {showHint ? (
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  💡 {question.hint}
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleHint}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Use Hint (-{hintCost} points)
                </Button>
              )}
            </div>
          )}

          {/* Result Message */}
          {showResult && (
            <div
              className={cn(
                "mt-6 text-center p-4 rounded-lg animate-slide-up",
                isCorrect ? "bg-success/10" : "bg-destructive/10"
              )}
            >
              <p
                className={cn(
                  "font-bold text-lg",
                  isCorrect ? "text-success" : "text-destructive"
                )}
              >
                {isCorrect ? "🎉 Correct!" : "❌ Incorrect"}
              </p>
              {!isCorrect && (
                <p className="text-sm text-muted-foreground mt-1">
                  The correct answer was: {question.options[question.correctIndex]}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
