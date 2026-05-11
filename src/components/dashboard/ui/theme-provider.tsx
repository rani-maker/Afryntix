"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type DashTheme = "dark" | "light";

const STORAGE_KEY = "afryntix-dash-theme";
const SIDEBAR_KEY = "afryntix-dash-sidebar-collapsed";

type Ctx = {
  theme: DashTheme;
  toggle: () => void;
  setTheme: (t: DashTheme) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
};

const DashThemeContext = createContext<Ctx | null>(null);

export function DashThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DashTheme>("dark");
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) as DashTheme | null;
    if (stored === "dark" || stored === "light") setThemeState(stored);
    const sb = localStorage.getItem(SIDEBAR_KEY);
    if (sb === "1") setSidebarCollapsedState(true);
    setMounted(true);
  }, []);

  const setTheme = useCallback((t: DashTheme) => {
    setThemeState(t);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedState(v);
    if (typeof window !== "undefined") localStorage.setItem(SIDEBAR_KEY, v ? "1" : "0");
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  return (
    <DashThemeContext.Provider
      value={{ theme, toggle, setTheme, sidebarCollapsed, toggleSidebar, setSidebarCollapsed, mobileNavOpen, setMobileNavOpen }}
    >
      <div
        className={`theme-dashboard ${theme === "light" ? "theme-light" : ""} min-h-screen`}
        data-mounted={mounted ? "1" : "0"}
      >
        {children}
      </div>
    </DashThemeContext.Provider>
  );
}

export function useDashTheme() {
  const ctx = useContext(DashThemeContext);
  if (!ctx) throw new Error("useDashTheme must be used inside DashThemeProvider");
  return ctx;
}
