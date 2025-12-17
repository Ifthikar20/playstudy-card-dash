import { Moon, Sun, Laptop } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = 'light' | 'dark' | 'dark-grey';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove('dark', 'dark-grey');

    // Add the current theme class (except for light which is default)
    if (theme !== 'light') {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme;
    if (stored && ['light', 'dark', 'dark-grey'].includes(stored)) {
      setTheme(stored);
    }
  }, []);

  const toggleTheme = () => {
    // Cycle through: light → dark → dark-grey → light
    const themeOrder: Theme[] = ['light', 'dark', 'dark-grey'];
    const currentIndex = themeOrder.indexOf(theme);
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];

    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun size={20} className="text-foreground" />;
      case 'dark':
        return <Moon size={20} className="text-foreground" />;
      case 'dark-grey':
        return <Laptop size={20} className="text-foreground" />;
      default:
        return <Sun size={20} className="text-foreground" />;
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-accent transition-colors"
      aria-label="Toggle theme"
      title={`Current: ${theme === 'dark-grey' ? 'Dark Grey' : theme.charAt(0).toUpperCase() + theme.slice(1)}`}
    >
      {getIcon()}
    </button>
  );
}
