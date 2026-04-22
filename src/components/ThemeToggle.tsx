import { Moon, Sun, Laptop } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = 'light' | 'dark' | 'dark-grey';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove('dark', 'dark-grey');

    // Add the current theme class
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'dark-grey') {
      // dark-grey needs both 'dark' (for Tailwind dark: variants) and 'dark-grey' (for custom CSS vars)
      root.classList.add('dark', 'dark-grey');
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
        return <Sun size={16} className="text-foreground" />;
      case 'dark':
        return <Moon size={16} className="text-foreground" />;
      case 'dark-grey':
        return <Laptop size={16} className="text-foreground" />;
      default:
        return <Sun size={16} className="text-foreground" />;
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="airbnb-icon-btn !p-2"
      aria-label="Toggle theme"
      title={`Current: ${theme === 'dark-grey' ? 'Dark Grey' : theme.charAt(0).toUpperCase() + theme.slice(1)}`}
    >
      {getIcon()}
    </button>
  );
}
