import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const ThemeToggle = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-circle btn-ghost text-xl"
      aria-label="Toggle Theme"
    >
      {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
};
