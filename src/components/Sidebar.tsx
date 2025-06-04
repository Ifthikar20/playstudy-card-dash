
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
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: BookOpen },
  { name: "Study Folders", href: "/folders", icon: FolderPlus },
  { name: "Speed Run", href: "/speedrun", icon: Zap },
  { name: "Achievements", href: "/achievements", icon: Trophy },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-full",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-gray-900">Playstudy.ai</h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-700 hover:bg-gray-100"
              )
            }
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!isCollapsed && <span className="ml-3">{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section with login and share - Fixed position */}
      <div className="mt-auto p-4 border-t border-gray-200 space-y-2">
        <button className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
          <LogIn size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Login</span>}
        </button>
        
        <button className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors">
          <Share2 size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Share for Free Credits</span>}
        </button>
      </div>
    </div>
  );
}
