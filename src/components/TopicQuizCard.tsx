import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Trophy, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface TopicQuizCardProps {
  topicTitle: string;
  questions: Question[];
  currentQuestionIndex: number;
  onAnswer: (answerIndex: number) => { correct: boolean; explanation: string };
  onMoveToNext: () => void;  // Move to next question
  onComplete: () => void;
  onSkipToNext?: () => void;  // Skip to next topic
  score: number | null;
  isCompleted: boolean;
}

export function TopicQuizCard({
  topicTitle,
  questions,
  currentQuestionIndex,
  onAnswer,
  onMoveToNext,
  onComplete,
  onSkipToNext,
  score,
  isCompleted,
}: TopicQuizCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  // Reset state when question changes
  useEffect(() => {
    console.log('🔄 Question index changed, resetting state. New index:', currentQuestionIndex);
    setSelectedAnswer(null);
    setShowResult(false);
    setResult(null);
  }, [currentQuestionIndex]);

  const handleSelectAnswer = (index: number) => {
    if (showResult) return; // Don't allow selecting after already answered

    console.log('📝 Answer selected:', index);
    setSelectedAnswer(index);

    // Immediately submit the answer
    const answerResult = onAnswer(index);
    setResult(answerResult);
    setShowResult(true);
    console.log('✅ Answer result:', answerResult.correct ? 'Correct' : 'Wrong');
  };

  const handleNext = () => {
    console.log('➡️ Next button clicked');
    if (isLastQuestion) {
      console.log('🏁 Last question - completing topic');
      onComplete();
    } else {
      console.log('🔄 Moving to next question');
      onMoveToNext();
    }
  };

  if (isCompleted) {
    const totalQuestions = questions.length;
    const pointsEarned = Math.round((score || 0) * totalQuestions / 100);

    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
        <CardContent className="p-6 text-center space-y-4">
          <Trophy className="mx-auto text-green-600 dark:text-green-400 mb-4" size={48} />
          <h3 className="text-xl font-bold text-foreground mb-2">Topic Complete!</h3>
          <p className="text-muted-foreground mb-4">{topicTitle}</p>

          <div className="space-y-2">
            <div className="text-5xl font-bold text-green-600 dark:text-green-400">
              {pointsEarned} / {totalQuestions}
            </div>
            <p className="text-lg font-semibold text-foreground">
              Points Earned
            </p>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {pointsEarned === totalQuestions
                ? "Perfect score! 🎉 Amazing work!"
                : pointsEarned >= totalQuestions * 0.7
                ? "Great job! Keep up the good work! 💪"
                : "Keep practicing to improve your score! 📚"}
            </p>
          </div>

          <div className="pt-2">
            <p className="text-xs text-primary font-medium">
              +{pointsEarned} XP added to your total learning points
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No questions available for this topic.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{topicTitle}</span>
            <span className="font-semibold text-foreground">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
          </div>
          <Progress
            value={((currentQuestionIndex + 1) / questions.length) * 100}
            className="h-2"
          />
        </div>

        <h3 className="text-lg font-semibold text-foreground">
          {currentQuestion.question}
        </h3>

        <div className="space-y-2">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = showResult && index === currentQuestion.correctAnswer;
            const isWrong = showResult && isSelected && index !== currentQuestion.correctAnswer;

            return (
              <button
                key={index}
                onClick={() => handleSelectAnswer(index)}
                disabled={showResult}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  !showResult && "hover:border-primary hover:bg-primary/5 cursor-pointer",
                  isSelected && !showResult && "border-primary bg-primary/10",
                  isCorrect && "border-green-500 bg-green-50 dark:bg-green-950/30",
                  isWrong && "border-red-500 bg-red-50 dark:bg-red-950/30",
                  showResult && !isCorrect && !isWrong && "opacity-50",
                  showResult && "cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {isCorrect && <CheckCircle2 className="text-green-600" size={20} />}
                  {isWrong && <XCircle className="text-red-600" size={20} />}
                </div>
              </button>
            );
          })}
        </div>

        {showResult && result && (
          <div className="space-y-3">
            <div className={cn(
              "p-4 rounded-lg text-sm animate-in fade-in slide-in-from-top-2 duration-300",
              result.correct
                ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200"
                : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
            )}>
              <p className="font-medium mb-1">
                {result.correct ? "Correct! 🎉" : "Not quite right"}
              </p>
              <p>{result.explanation}</p>
            </div>

            <Button
              onClick={handleNext}
              className="w-full"
              size="lg"
            >
              {isLastQuestion ? "Complete Topic ✓" : "Next Question →"}
            </Button>
          </div>
        )}

        {onSkipToNext && !showResult && (
          <div className="flex justify-start pt-2">
            <Button
              variant="outline"
              onClick={onSkipToNext}
              className="gap-2"
            >
              <SkipForward size={16} />
              Skip to Next Topic
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
