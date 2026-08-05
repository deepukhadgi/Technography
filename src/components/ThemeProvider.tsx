"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "tg_theme";
const LIGHT_CLASS = "light"; // dark is the default (:root), only light needs a class

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolve the initial theme: stored preference, else system preference,
 * else dark (the site default). Mirrors the inline head script in
 * layout.tsx, which applies the class pre-hydration to avoid a flash.
 */
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable */
  }
  try {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
  } catch {
    /* matchMedia unavailable */
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const mounted = useRef(false);

  // Mount: reconcile React state with the class the inline head script
  // applied pre-hydration (and apply it ourselves if that script was
  // blocked). Keeps the toggle from ever stripping the class React state
  // doesn't know about yet, so there is no flash on first paint.
  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    document.documentElement.classList.toggle(LIGHT_CLASS, initial === "light");
    try {
      window.localStorage.setItem(STORAGE_KEY, initial);
    } catch {
      /* storage unavailable */
    }
    mounted.current = true;
  }, []);

  // Subsequent changes: keep the class on <html> and the stored
  // preference in sync.
  useEffect(() => {
    if (!mounted.current) return;
    document.documentElement.classList.toggle(LIGHT_CLASS, theme === "light");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

export default ThemeProvider;
