import { Home, Gamepad2, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "leaderboard", label: "Rankings", icon: Trophy },
  { id: "profile", label: "Profile", icon: User },
];

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 px-4 min-w-[64px] min-h-[44px] transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={item.label}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn("text-xs font-medium", isActive && "text-primary")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
