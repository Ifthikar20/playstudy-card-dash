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
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

const navigation = [
  { name: "Dashboard", href: "/", icon: BookOpen },
  { name: "Study Folders", href: "/folders", icon: FolderPlus },
  { name: "Full Study", href: "/full-study", icon: GraduationCap },
  { name: "Speed Run", href: "/speedrun", icon: Zap },
  { name: "Achievements", href: "/achievements", icon: Trophy },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      "bg-card border-r border-border transition-all duration-300 flex flex-col h-screen sticky top-0",
      isCollapsed ? "w-16" : "w-64"
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

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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

      {/* Bottom section with profile, theme toggle, login and share */}
      <div className="p-4 border-t border-border space-y-2">
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
