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
  LogIn,
  Share2,
  Zap,
  GraduationCap,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";

const navigation = [
  { name: "Dashboard", href: "/", icon: BookOpen },
  { name: "Study Folders", href: "/folders", icon: FolderPlus },
  { name: "Full Study", href: "/full-study", icon: GraduationCap },
  { name: "Speed Run", href: "/speedrun", icon: Zap },
  { name: "Achievements", href: "/achievements", icon: Trophy },
  { name: "Settings", href: "/settings", icon: Settings },
];

const recentGames = [
  { id: 1, title: "Math Speed Challenge", score: 92, time: "2 hours ago" },
  { id: 2, title: "Science Quiz Battle", score: 85, time: "5 hours ago" },
  { id: 3, title: "History Trivia Rush", score: 78, time: "Yesterday" },
  { id: 4, title: "Language Master", score: 95, time: "Yesterday" },
  { id: 5, title: "Geography Explorer", score: 88, time: "2 days ago" },
  { id: 6, title: "Coding Challenge", score: 91, time: "2 days ago" },
  { id: 7, title: "Physics Fundamentals", score: 82, time: "3 days ago" },
  { id: 8, title: "Chemistry Quiz", score: 76, time: "4 days ago" },
  { id: 9, title: "Biology Basics", score: 89, time: "5 days ago" },
  { id: 10, title: "Art History", score: 94, time: "1 week ago" },
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
            <h1 className="text-xl font-bold text-foreground">Playstudy.ai</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            {isCollapsed ? <Menu size={20} className="text-foreground" /> : <X size={20} className="text-foreground" />}
          </button>
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
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )
            }
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!isCollapsed && <span className="ml-3">{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Recent Games Section */}
      {!isCollapsed && (
        <div className="flex-1 px-4 pb-2 overflow-hidden">
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Clock size={16} />
            Recent Games
          </h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="space-y-1 pr-2">
              {recentGames.map((game) => (
                <div 
                  key={game.id} 
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{game.title}</p>
                    <p className="text-[10px] text-muted-foreground">{game.time}</p>
                  </div>
                  <div className="text-xs font-semibold text-primary ml-2">{game.score}%</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Bottom section with profile, theme toggle, login and share */}
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
        
        <button className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <LogIn size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Login</span>}
        </button>
        
        <button className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
          <Share2 size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Share for Free Credits</span>}
        </button>
      </div>
    </div>
  );
}
