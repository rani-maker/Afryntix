"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translations, LANG_ORDER, type Lang, type TKey } from "@/lib/i18n";

const STORAGE_KEY = "afryntix-public-lang";
const COOKIE_NAME = "afryntix_lang";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANG_ORDER as readonly string[]).includes(value);
}

function readClientLang(fallback: Lang): Lang {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`),
    );
    const cookieVal = match ? decodeURIComponent(match[1]) : null;
    if (isLang(cookieVal)) return cookieVal;
  } catch {}
  return fallback;
}

function persistLang(value: Lang) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
  try {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
      value,
    )}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {}
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: TKey) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function PublicLanguageProvider({
  children,
  initialLang = "fr",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const current = readClientLang(initialLang);
    if (current !== lang) setLangState(current);
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && isLang(e.newValue)) setLangState(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang =
        lang === "zh"
          ? "zh-CN"
          : lang === "es"
            ? "es"
            : lang === "en"
              ? "en"
              : "fr";
    }
    persistLang(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
  }, []);

  const toggle = useCallback(() => {
    setLangState((current) => {
      const idx = LANG_ORDER.indexOf(current);
      return LANG_ORDER[(idx + 1) % LANG_ORDER.length];
    });
  }, []);

  const t = useCallback(
    (key: TKey) => translations[lang][key] ?? translations.fr[key] ?? key,
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useLang must be used inside PublicLanguageProvider");
  return ctx;
}
