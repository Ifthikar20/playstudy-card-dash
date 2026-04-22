import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  FolderPlus,
  User,
  Search,
  Zap,
  GraduationCap,
  Mic,
  Globe,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAppStore } from "@/store/appStore";
import { AnimatedXP } from "@/components/AnimatedXP";
import UserMenu from "@/components/UserMenu";

import { Gamepad2 } from "lucide-react";

const mainNavigation: Array<{ name: string; href: string; icon: typeof BookOpen }> = [
  { name: "Dashboard", href: "/dashboard", icon: BookOpen },
  { name: "Folders", href: "/dashboard/folders", icon: FolderPlus },
];

const sessionNavigation: Array<{ name: string; href: (sessionId: string) => string; icon: typeof BookOpen; gamified?: boolean }> = [
  { name: "Game Zone", href: (sessionId) => `/dashboard/browse-games`, icon: Gamepad2, gamified: true },
  { name: "Full Study", href: (sessionId) => `/dashboard/${sessionId}/full-study`, icon: GraduationCap },
  { name: "Speed Run", href: (sessionId) => `/dashboard/${sessionId}/speedrun`, icon: Zap },
  { name: "Mentor", href: (sessionId) => `/dashboard/${sessionId}/mentor`, icon: Mic },
];

export function Sidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { currentSession, setCurrentSession } = useAppStore();
  const location = useLocation();

  return (
    <>
      {/* Airbnb-style Top Navigation */}
      <header className="airbnb-nav">
        <div className="airbnb-container">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Left: Logo */}
            <NavLink to="/dashboard" onClick={() => setCurrentSession(null)} className="flex items-center gap-2 flex-shrink-0">
              <img
                src="/logo-new.png"
                alt="PlayStudy"
                className="h-10 md:h-12 w-auto"
              />
            </NavLink>

            {/* Center: Navigation Pills (desktop) */}
            <nav className="hidden md:flex items-center gap-1">
              {mainNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setCurrentSession(null)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      isActive && location.pathname === item.href
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )
                  }
                >
                  <item.icon size={16} />
                  {item.name}
                </NavLink>
              ))}

              {/* Session-specific navigation pills */}
              {currentSession && (
                <>
                  <div className="w-px h-5 bg-border mx-1" />
                  {sessionNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href(currentSession.id)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-primary text-white"
                            : item.gamified
                            ? "text-primary hover:bg-primary/10"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )
                      }
                    >
                      <item.icon size={16} />
                      {item.name}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <AnimatedXP />
              <ThemeToggle />
              <UserMenu />

              {/* Mobile menu toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-full hover:bg-accent transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X size={20} className="text-foreground" />
                ) : (
                  <Menu size={20} className="text-foreground" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background animate-fade-in-up">
            <div className="airbnb-container py-4 space-y-1">
              {mainNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => {
                    setCurrentSession(null);
                    setIsMobileMenuOpen(false);
                  }}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      isActive && location.pathname === item.href
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-accent"
                    )
                  }
                >
                  <item.icon size={18} />
                  {item.name}
                </NavLink>
              ))}

              {currentSession && (
                <>
                  <div className="h-px bg-border my-2" />
                  <p className="text-xs text-muted-foreground px-4 pt-2 pb-1 font-medium">Study Modes</p>
                  {sessionNavigation.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href(currentSession.id)}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-accent"
                        )
                      }
                    >
                      <item.icon size={18} />
                      {item.name}
                    </NavLink>
                  ))}
                </>
              )}

              {/* Profile link in mobile */}
              <div className="h-px bg-border my-2" />
              <NavLink
                to="/dashboard/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-accent"
                  )
                }
              >
                <User size={18} />
                Profile & Settings
              </NavLink>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
