import { useState } from "react";
import { NavLink } from "react-router-dom";
import { 
  BookOpen, 
  FolderPlus, 
  Trophy, 
  Settings, 
  User,
  Menu,
  X,
  Share2,
  Zap,
  GraduationCap,
  Clock,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Gamepad2 } from "lucide-react";

const navigation: Array<{ name: string; href: string; icon: typeof BookOpen; gamified?: boolean }> = [
  { name: "Dashboard", href: "/", icon: BookOpen },
  { name: "Study Folders", href: "/folders", icon: FolderPlus },
  { name: "🎮 Game Zone", href: "/browse-games", icon: Gamepad2, gamified: true },
  { name: "Full Study", href: "/full-study", icon: GraduationCap },
  { name: "Speed Run", href: "/speedrun", icon: Zap },
  { name: "Achievements", href: "/achievements", icon: Trophy },
  { name: "Settings", href: "/settings", icon: Settings },
];

const recentStudySessions = [
  { id: 1, title: "Calculus Fundamentals", progress: 92, time: "2 hours ago", topics: 12 },
  { id: 2, title: "Organic Chemistry", progress: 85, time: "5 hours ago", topics: 8 },
  { id: 3, title: "World War II History", progress: 78, time: "Yesterday", topics: 15 },
  { id: 4, title: "Spanish Vocabulary", progress: 95, time: "Yesterday", topics: 20 },
  { id: 5, title: "Geography Capitals", progress: 88, time: "2 days ago", topics: 10 },
  { id: 6, title: "Python Basics", progress: 91, time: "2 days ago", topics: 14 },
  { id: 7, title: "Classical Mechanics", progress: 82, time: "3 days ago", topics: 11 },
  { id: 8, title: "Periodic Table", progress: 76, time: "4 days ago", topics: 9 },
  { id: 9, title: "Cell Biology", progress: 89, time: "5 days ago", topics: 13 },
  { id: 10, title: "Renaissance Art", progress: 94, time: "1 week ago", topics: 7 },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      "bg-card border-r border-border transition-all duration-300 flex flex-col h-screen sticky top-0",
      isCollapsed ? "w-16" : "w-72"
    )}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-primary">Playstudy.ai</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {isCollapsed ? <Menu size={20} className="text-foreground" /> : <X size={20} className="text-foreground" />}
          </button>
        </div>
        {/* Points Display */}
        <div className="mt-3 flex items-center gap-2 px-2 py-1.5 bg-primary/10 rounded-lg">
          <Star size={16} className="text-primary fill-primary" />
          {!isCollapsed && (
            <span className="text-sm font-semibold text-primary">2,450 Points</span>
          )}
        </div>
      </div>

      <nav className="p-4 space-y-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                item.gamified && "bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 hover:from-purple-500/20 hover:via-pink-500/20 hover:to-orange-500/20"
              )
            }
          >
            <item.icon size={20} className={cn("flex-shrink-0", item.gamified && "text-purple-500")} />
            {!isCollapsed && (
              <span className={cn("ml-3", item.gamified && "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent font-bold")}>
                {item.name}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Recent Study Sessions Section */}
      {!isCollapsed && (
        <div className="flex-1 px-4 pb-2 overflow-hidden">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Clock size={16} />
            Recent Study Sessions
          </h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="space-y-1 pr-2">
              {recentStudySessions.map((session) => (
                <div 
                  key={session.id} 
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{session.title}</p>
                    <p className="text-[10px] text-muted-foreground">{session.time} • {session.topics} topics</p>
                  </div>
                  <div className="text-xs font-semibold text-primary ml-2">{session.progress}%</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Bottom section with profile, theme toggle and share */}
      <div className="p-4 border-t border-border space-y-2 mt-auto">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )
          }
        >
          <User size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Profile</span>}
        </NavLink>

        <div className="flex items-center justify-between">
          {!isCollapsed && <span className="text-sm text-muted-foreground">Theme</span>}
          <ThemeToggle />
        </div>
        
        <button className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
          <Share2 size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Share for Free Credits</span>}
        </button>
      </div>
    </div>
  );
}
