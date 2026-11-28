"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

const THEME_STORAGE_KEY = "chatbot_theme";
const THEME_CHANGE_EVENT = "chatbot-theme-change";

const ThemeContext = createContext({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

function resolveThemeMode(preference) {
  if (preference === "dark") return "dark";
  if (preference === "system" && typeof window !== "undefined") {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
      ? "dark"
      : "light";
  }
  return "light";
}

function applyThemeToDom(preference) {
  const isDark = resolveThemeMode(preference) === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

function subscribeTheme(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    media?.removeEventListener?.("change", callback);
  };
}

function getThemeSnapshot() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "system" || saved === "light") {
      return saved;
    }
    return "light";
  } catch {
    return "light";
  }
}

function getResolvedSnapshot() {
  return resolveThemeMode(getThemeSnapshot());
}

function getServerThemeSnapshot() {
  return "light";
}

export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const resolvedTheme = useSyncExternalStore(
    subscribeTheme,
    getResolvedSnapshot,
    getServerThemeSnapshot
  );

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme, resolvedTheme]);

  function setTheme(nextTheme) {
    const normalized =
      nextTheme === "dark" || nextTheme === "system" ? nextTheme : "light";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage access errors.
    }
    applyThemeToDom(normalized);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  function toggleTheme() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
