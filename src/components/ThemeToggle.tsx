"use client";

import { useTheme } from "@/components/ThemeProvider";

/**
 * Terminal-styled theme toggle: sun icon in dark mode (click → light),
 * moon icon in light mode (click → dark). Matches the mobile nav button
 * styling (44px tap target on small screens). SVG icons inherit the
 * current color (text-dim, hover:text-accent) via stroke="currentColor".
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
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded border border-line text-dim transition-colors hover:border-accent/50 hover:text-accent sm:h-9 sm:w-9"
    >
      <span aria-hidden="true">
        {isLight ? (
          /* moon — click to go dark */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
            />
          </svg>
        ) : (
          /* sun — click to go light */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
