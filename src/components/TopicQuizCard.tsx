import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ArrowRight, Trophy, SkipForward } from "lucide-react";
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
  onComplete: () => void;
  onSkipToNext?: () => void;  // New prop to skip to next topic
  score: number | null;
  isCompleted: boolean;
}

export function TopicQuizCard({
  topicTitle,
  questions,
  currentQuestionIndex,
  onAnswer,
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

  const handleSelectAnswer = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    const answerResult = onAnswer(selectedAnswer);
    setResult(answerResult);
    setShowResult(true);
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowResult(false);
    setResult(null);
    
    if (isLastQuestion) {
      onComplete();
    }
  };

  if (isCompleted) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
        <CardContent className="p-6 text-center">
          <Trophy className="mx-auto text-green-600 dark:text-green-400 mb-4" size={48} />
          <h3 className="text-xl font-bold text-foreground mb-2">Topic Completed!</h3>
          <p className="text-muted-foreground mb-4">{topicTitle}</p>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {Math.round(score || 0)}%
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Great job! Move on to the next topic.
          </p>
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
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{topicTitle}</span>
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
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
                  "hover:border-primary hover:bg-primary/5",
                  isSelected && !showResult && "border-primary bg-primary/10",
                  isCorrect && "border-green-500 bg-green-50 dark:bg-green-950/30",
                  isWrong && "border-red-500 bg-red-50 dark:bg-red-950/30",
                  showResult && !isCorrect && !isWrong && "opacity-50"
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
          <div className={cn(
            "p-4 rounded-lg text-sm",
            result.correct 
              ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200" 
              : "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
          )}>
            <p className="font-medium mb-1">
              {result.correct ? "Correct! 🎉" : "Not quite right"}
            </p>
            <p>{result.explanation}</p>
          </div>
        )}

        <div className="flex justify-between pt-2">
          {onSkipToNext && (
            <Button
              variant="outline"
              onClick={onSkipToNext}
              className="gap-2"
            >
              <SkipForward size={16} />
              Skip to Next Topic
            </Button>
          )}
          <div className="flex-1" />
          {!showResult ? (
            <Button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null}
            >
              Submit Answer
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {isLastQuestion ? "Complete Topic" : "Next Question"}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
