"use client";

import { useEffect, useState } from "react";

/**
 * Reading progress bar (client component — needs window scroll events).
 *
 * A thin accent-colored line pinned to the top of the viewport that fills
 * left → right as the user scrolls down the post. Purely decorative:
 * - `bg-accent` maps to `var(--color-accent)` (Tailwind v4 `@theme inline`),
 *   so it follows the dark/light theme automatically.
 * - Renders null until mounted (server render and the first client render
 *   both return null → no hydration mismatch; `typeof window` is only
 *   defined on the client).
 * - Passive scroll/resize listeners with a requestAnimationFrame throttle
 *   keep it smooth without janking the main thread.
 */
export default function ReadingProgress() {
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setMounted(true);

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const scrollable =
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        ) - window.innerHeight;
      if (scrollable <= 0) {
        setProgress(0);
        return;
      }
      const pct = Math.min(
        100,
        Math.max(0, (window.scrollY / scrollable) * 100)
      );
      setProgress(pct);
    };

    const onScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(update);
      }
    };

    update(); // set the initial position on mount
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!mounted || typeof window === "undefined") {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-accent transition-[width] duration-100 ease-out"
      style={{ width: `${progress}%` }}
    />
  );
}
