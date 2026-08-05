"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  THEME_PREFERENCE_COOKIE,
  THEME_PREFERENCE_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference
} from "./theme-preference";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference | null {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function initialThemePreference(initialPreference?: string): ThemePreference {
  const cookiePreference = parseThemePreference(initialPreference);
  if (cookiePreference) return cookiePreference;
  if (typeof window === "undefined") return "system";
  return readStoredPreference() ?? "system";
}

function initialSystemPreference(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function persistPreference(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Private browsing and hardened browsers can disable local storage. The cookie remains enough.
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_PREFERENCE_COOKIE}=${preference}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  document.documentElement.dataset.theme = preference;
  document.documentElement.style.colorScheme = resolvedTheme;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = resolvedTheme === "dark" ? "#08130f" : "#f4f8f1";
}

export function ThemeProvider({ children, initialPreference }: { children: React.ReactNode; initialPreference?: string }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => initialThemePreference(initialPreference));
  const [systemPrefersDark, setSystemPrefersDark] = useState(initialSystemPreference);
  const resolvedTheme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemPreference = () => setSystemPrefersDark(media.matches);
    media.addEventListener("change", updateSystemPreference);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_PREFERENCE_STORAGE_KEY) return;
      const nextPreference = parseThemePreference(event.newValue);
      if (nextPreference) setPreferenceState(nextPreference);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", updateSystemPreference);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    applyTheme(preference, resolvedTheme);
  }, [preference, resolvedTheme]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    persistPreference(nextPreference);
  }, []);

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemePreference must be used inside ThemeProvider.");
  return context;
}
