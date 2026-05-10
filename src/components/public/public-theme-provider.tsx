"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type PublicTheme = "light" | "dark";

const STORAGE_KEY = "afryntix-public-theme";

type Ctx = {
  theme: PublicTheme;
  toggle: () => void;
  setTheme: (t: PublicTheme) => void;
};

const PublicThemeContext = createContext<Ctx | null>(null);

export function PublicThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PublicTheme>("dark");

  useEffect(() => {
    const stored =
      (typeof window !== "undefined" &&
        (localStorage.getItem(STORAGE_KEY) as PublicTheme | null)) || null;
    if (stored === "light" || stored === "dark") setThemeState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  const setTheme = useCallback((t: PublicTheme) => {
    setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <PublicThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </PublicThemeContext.Provider>
  );
}

export function usePublicTheme() {
  const ctx = useContext(PublicThemeContext);
  if (!ctx)
    throw new Error("usePublicTheme must be used inside PublicThemeProvider");
  return ctx;
}
