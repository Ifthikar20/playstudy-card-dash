import { Star, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface GameCardProps {
  title: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  points: number;
  icon: React.ReactNode;
  progress?: number;
  onPlay: () => void;
}

export function GameCard({
  title,
  category,
  difficulty,
  points,
  icon,
  progress,
  onPlay,
}: GameCardProps) {
  const difficultyStars = difficulty === "Easy" ? 1 : difficulty === "Medium" ? 3 : 5;
  const difficultyColor =
    difficulty === "Easy"
      ? "text-success"
      : difficulty === "Medium"
      ? "text-warning"
      : "text-destructive";

  return (
    <div className="group bg-card rounded-xl border border-border p-4 sm:p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30">
      {/* Icon/Thumbnail */}
      <div className="aspect-[16/9] rounded-lg gradient-primary flex items-center justify-center mb-4 overflow-hidden">
        <div className="text-primary-foreground transform group-hover:scale-110 transition-transform duration-200">
          {icon}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-bold text-sm sm:text-base line-clamp-2 mb-2 group-hover:text-primary transition-colors">
        {title}
      </h3>

      {/* Category Badge */}
      <span className="inline-block text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground mb-3">
        {category}
      </span>

      {/* Difficulty & Points Row */}
      <div className="flex items-center justify-between mb-4">
        {/* Difficulty Stars */}
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-3 w-3 sm:h-4 sm:w-4",
                i < difficultyStars ? difficultyColor : "text-muted"
              )}
              fill={i < difficultyStars ? "currentColor" : "none"}
            />
          ))}
          <span className={cn("text-xs ml-1.5 font-medium", difficultyColor)}>
            {difficulty}
          </span>
        </div>

        {/* Points */}
        <div className="flex items-center gap-1">
          <Trophy className="h-4 w-4 text-warning" />
          <span className="font-bold text-sm sm:text-base">{points}</span>
        </div>
      </div>

      {/* Progress Bar (if started) */}
      {progress !== undefined && progress > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Play Button */}
      <Button
        onClick={onPlay}
        className="w-full gradient-primary hover:opacity-90 transition-opacity"
      >
        <Play className="h-4 w-4 mr-2" />
        {progress && progress > 0 ? "Continue" : "Play Now"}
      </Button>
    </div>
  );
}
