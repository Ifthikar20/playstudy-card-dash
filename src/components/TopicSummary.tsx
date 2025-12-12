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
  const percentage = Math.round(score);
  const isPassing = percentage >= 70;

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="p-6 text-center space-y-4">
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${
          isPassing 
            ? "bg-green-100 dark:bg-green-900/30" 
            : "bg-amber-100 dark:bg-amber-900/30"
        }`}>
          <Trophy 
            size={40} 
            className={isPassing ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"} 
          />
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground">Topic Complete!</h3>
          <p className="text-muted-foreground">{topicTitle}</p>
        </div>

        <div className={`text-4xl font-bold ${
          isPassing ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
        }`}>
          {percentage}%
        </div>

        <p className="text-sm text-muted-foreground">
          {isPassing 
            ? "Great job! You've mastered this topic." 
            : "Keep practicing to improve your score."}
        </p>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onRetry} className="flex-1">
            <RotateCcw size={16} className="mr-2" />
            Retry
          </Button>
          <Button onClick={onContinue} className="flex-1">
            {isLastTopic ? "Finish Study" : "Next Topic"}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
