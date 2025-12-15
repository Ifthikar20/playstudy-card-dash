import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BookOpen,
  FolderPlus,
  Trophy,
  User,
  Menu,
  X,
  Share2,
  Zap,
  GraduationCap,
  Clock,
  Star,
  Check,
  Trash2,
  Archive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/store/appStore";

import { Gamepad2 } from "lucide-react";

const navigation: Array<{ name: string; href: string; icon: typeof BookOpen; gamified?: boolean }> = [
  { name: "Dashboard", href: "/", icon: BookOpen },
  { name: "Study Folders", href: "/folders", icon: FolderPlus },
  { name: "🎮 Game Zone", href: "/browse-games", icon: Gamepad2, gamified: true },
  { name: "Full Study", href: "/full-study", icon: GraduationCap },
  { name: "Speed Run", href: "/speedrun", icon: Zap },
];

export function Sidebar() {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { studySessions, currentSession, setCurrentSession, deleteStudySession, archiveStudySession } = useAppStore();
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
        {/* XP Display */}
        {!isCollapsed && (
          <div className="mt-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm font-bold text-primary animate-[pulse_2s_ease-in-out_infinite]">
              2,450 XP
            </span>
          </div>
        )}
      </div>

      <nav className="p-4 space-y-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={() => setCurrentSession(null)}
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

      {/* Study Sessions Section - Grouped by Content */}
      {!isCollapsed && (
        <div className="flex-1 px-4 pt-4 pb-2 overflow-hidden">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BookOpen size={16} />
            Study Sessions by Content
          </h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            <div className="space-y-1 pr-2">
              {studySessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center justify-between p-2 rounded-lg transition-colors",
                    currentSession?.id === session.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      setCurrentSession(session);
                      navigate(`/full-study/${session.id}`);
                    }}
                  >
                    <p className="text-xs font-medium text-foreground truncate">{session.title}</p>
                    <p className="text-[10px] text-muted-foreground">{session.topics} topics • {session.progress}% complete</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {currentSession?.id === session.id && (
                      <Check size={12} className="text-primary" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${session.title}"?`)) {
                          // Optimistic delete - UI updates immediately
                          deleteStudySession(session.id);
                        }
                      }}
                      className="ml-1 p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded transition-all"
                      title="Delete session"
                    >
                      <Trash2 size={12} className="text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

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
          {!isCollapsed && <span className="ml-3">Profile & Settings</span>}
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
