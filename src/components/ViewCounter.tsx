"use client";

import { useEffect, useState } from "react";

type ViewCounterProps = {
  slug: string;
  /** When provided, display without incrementing (read-only mode for listing pages). */
  initialViewCount?: number;
};

/**
 * Client component that shows an eye icon + view count.
 *
 * On the single-post page (no initialViewCount) it POSTs /api/views on mount
 * to increment the counter and then displays the updated total.
 *
 * On listing pages (initialViewCount provided) it renders read-only — no
 * increment call is made.
 */
export default function ViewCounter({ slug, initialViewCount }: ViewCounterProps) {
  const [views, setViews] = useState<number | undefined>(initialViewCount);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Read-only mode: caller already supplied the count — no API call.
    if (initialViewCount !== undefined) return;

    let cancelled = false;

    async function record() {
      try {
        const res = await fetch("/api/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { views?: number };
        if (!cancelled) setViews(data.views ?? 0);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    record();
    return () => {
      cancelled = true;
    };
  }, [slug, initialViewCount]);

  if (error || views === undefined) return null;

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs text-dim">
      {/* Eye icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-3.5 opacity-70"
      >
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>{views.toLocaleString()} views</span>
    </span>
  );
}
