"use client";

import { useTheme } from "@/components/ThemeProvider";

/**
 * Terminal-styled theme toggle: ☀ in dark mode (click → light),
 * ☾ in light mode (click → dark). Matches the mobile nav button
 * styling (44px tap target on small screens).
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="toggle theme"
      title={isLight ? "switch to dark mode" : "switch to light mode"}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded border border-line text-base text-dim transition-colors hover:border-accent/50 hover:text-accent sm:h-9 sm:w-9"
    >
      <span aria-hidden="true">{isLight ? "☾" : "☀"}</span>
    </button>
  );
}
