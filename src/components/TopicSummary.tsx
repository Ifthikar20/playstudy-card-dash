import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowRight, RotateCcw } from "lucide-react";

interface TopicSummaryProps {
  topicTitle: string;
  score: number;
  totalQuestions: number;
  onContinue: () => void;
  onRetry: () => void;
  isLastTopic: boolean;
}

export function TopicSummary({
  topicTitle,
  score,
  totalQuestions,
  onContinue,
  onRetry,
  isLastTopic,
}: TopicSummaryProps) {
  // Convert percentage score to points
  const pointsEarned = Math.round((score || 0) * totalQuestions / 100);
  const isPassing = pointsEarned >= totalQuestions * 0.7;

  // Determine card styling based on score
  const cardClass = isPassing
    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
    : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20";

  const scoreColor = isPassing
    ? "text-green-600 dark:text-green-400"
    : "text-amber-600 dark:text-amber-400";

  return (
    <Card className={`max-w-md mx-auto ${cardClass}`}>
      <CardContent className="p-6 text-center space-y-4">
        <Trophy
          className={`mx-auto ${scoreColor} mb-4`}
          size={48}
        />

        <div>
          <h3 className="text-xl font-bold text-foreground mb-2">Topic Complete!</h3>
          <p className="text-muted-foreground mb-4">{topicTitle}</p>
        </div>

        <div className="space-y-2">
          <div className={`text-5xl font-bold ${scoreColor}`}>
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

        {!isPassing && (
          <div className="pt-2 px-4 py-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              ⚠️ Your score is below the passing threshold. Would you like to retry this topic to improve your understanding, or continue to the next section?
            </p>
          </div>
        )}

        <div className="pt-2">
          <p className="text-xs text-primary font-medium">
            +{pointsEarned} XP added to your total learning points
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onRetry} className="flex-1">
            <RotateCcw size={16} className="mr-2" />
            Retry Topic
          </Button>
          <Button
            onClick={onContinue}
            className="flex-1"
            variant={isPassing ? "default" : "secondary"}
          >
            {isLastTopic ? "Finish Study" : "Continue Anyway"}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
