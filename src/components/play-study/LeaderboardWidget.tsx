import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  avatar?: string;
}

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: "Alex M.", points: 15420 },
  { rank: 2, name: "Sarah K.", points: 14850 },
  { rank: 3, name: "James L.", points: 13200 },
  { rank: 4, name: "Emma W.", points: 12100 },
  { rank: 5, name: "Mike R.", points: 11500 },
];

export function LeaderboardWidget() {
  const [isExpanded, setIsExpanded] = useState(true);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-4 w-4 text-warning" />;
      case 2:
        return <Medal className="h-4 w-4 text-muted-foreground" />;
      case 3:
        return <Medal className="h-4 w-4 text-warning/70" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground">{rank}</span>;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <h3 className="font-bold text-sm sm:text-base">Top Players</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 animate-slide-up">
          <div className="space-y-2">
            {mockLeaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg",
                  entry.rank === 1 && "bg-warning/10",
                  entry.rank === 2 && "bg-muted/50",
                  entry.rank === 3 && "bg-warning/5"
                )}
              >
                <div className="w-6 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.name}</p>
                </div>
                <div className="text-sm font-bold text-primary">
                  {entry.points.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
