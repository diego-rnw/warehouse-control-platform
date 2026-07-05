import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
  importeColor: string;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

function readSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem('ca-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage no disponible — usar default
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readSavedTheme);

  useEffect(() => {
    document.getElementById('ca-app')?.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('ca-theme', next);
      } catch {
        // ignorar si localStorage no está disponible
      }
      return next;
    });
  }

  const importeColor = theme === 'light' ? '#8a6d00' : '#FFCD02';

  return <ThemeContext.Provider value={{ theme, toggleTheme, importeColor }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
