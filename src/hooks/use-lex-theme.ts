import { useEffect, useState } from "react";

const STORAGE_KEY = "lextrack-theme";

export function useLexTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(STORAGE_KEY) as "light" | "dark") || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setThemeState((t) => (t === "light" ? "dark" : "light"));

  return { theme, setTheme: setThemeState, toggle };
}
