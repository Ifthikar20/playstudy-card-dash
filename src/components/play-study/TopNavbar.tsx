import { Menu, User, Trophy, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface TopNavbarProps {
  points: number;
  level: number;
  onMenuClick: () => void;
}

export function TopNavbar({ points, level, onMenuClick }: TopNavbarProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border">
      <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
        {/* Left: Logo & Menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg gradient-primary flex items-center justify-center">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-base sm:text-lg text-gradient hidden sm:inline">
              Play Study AI
            </span>
            <span className="font-bold text-base text-gradient sm:hidden">
              PSA
            </span>
          </div>
        </div>

        {/* Right: Points, Level, Avatar */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Points */}
          <div className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1.5 sm:px-3 sm:py-2">
            <Trophy className="h-4 w-4 text-warning" />
            <span
              className={`font-bold text-sm sm:text-base ${
                isAnimating ? "animate-points-pop" : ""
              }`}
            >
              {points.toLocaleString()}
            </span>
          </div>

          {/* Level Badge */}
          <div className="hidden sm:flex items-center gap-1.5 gradient-primary rounded-full px-3 py-1.5">
            <span className="text-primary-foreground text-sm font-semibold">
              Lvl {level}
            </span>
          </div>

          {/* Mobile Level */}
          <div className="sm:hidden gradient-primary rounded-full h-8 w-8 flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">
              {level}
            </span>
          </div>

          {/* Avatar */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-8 w-8 sm:h-10 sm:w-10 bg-muted"
            aria-label="User profile"
          >
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
