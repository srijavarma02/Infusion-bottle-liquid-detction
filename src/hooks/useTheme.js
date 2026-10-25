import { useEffect, useState } from "react";

const STORAGE_KEY = "smart-saline-theme";

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme: () =>
      setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
  };
}

export default useTheme;
