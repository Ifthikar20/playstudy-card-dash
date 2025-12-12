import { Clock, Zap, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface DailyChallengeCardProps {
  title: string;
  description: string;
  reward: number;
  progress: number;
  total: number;
  timeLeft: string;
  onStart: () => void;
}

export function DailyChallengeCard({
  title,
  description,
  reward,
  progress,
  total,
  timeLeft,
  onStart,
}: DailyChallengeCardProps) {
  const progressPercent = (progress / total) * 100;
  const isCompleted = progress >= total;

  return (
    <div className="bg-card rounded-xl border-2 border-primary/30 p-4 sm:p-6 relative overflow-hidden">
      {/* Gradient overlay */}
      <div className="absolute inset-0 gradient-primary opacity-5" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Daily Challenge</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{timeLeft} left</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-warning/10 text-warning px-2 py-1 rounded-full">
            <Gift className="h-4 w-4" />
            <span className="font-bold text-sm">+{reward}</span>
          </div>
        </div>

        {/* Challenge Info */}
        <p className="font-medium mb-1">{title}</p>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {progress}/{total}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Action Button */}
        <Button
          onClick={onStart}
          className={`w-full ${
            isCompleted
              ? "bg-success hover:bg-success/90"
              : "gradient-primary hover:opacity-90"
          }`}
          disabled={isCompleted}
        >
          {isCompleted ? "Completed! ✓" : "Start Challenge"}
        </Button>
      </div>
    </div>
  );
}
