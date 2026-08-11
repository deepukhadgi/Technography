"use client";

import { useBookmark } from "@/components/BookmarkProvider";
import { useState } from "react";

type BookmarkButtonProps = {
  slug: string;
  /** Show loading spinner while the first load fetch completes. */
  showLoading?: boolean;
  /** Size modifier: "sm" for compact, default is medium. */
  size?: "sm" | "md";
};

export default function BookmarkButton({
  slug,
  showLoading = false,
  size = "md",
}: BookmarkButtonProps) {
  const { isBookmarked, toggleBookmark } = useBookmark(slug);
  const [pending, setPending] = useState(false);

  const isFilled = isBookmarked;
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const tapTarget = size === "sm" ? "h-9 w-9" : "h-10 w-10";

  async function handleClick() {
    if (pending) return;
    setPending(true);
    try {
      await toggleBookmark();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={isFilled ? "remove bookmark" : "add bookmark"}
      title={isFilled ? "Remove from reading list" : "Save for later"}
      className={`flex shrink-0 items-center justify-center rounded border transition-colors ${tapTarget}
        ${
          isFilled
            ? "border-accent/60 bg-accent/10 text-accent hover:border-accent hover:bg-accent/20"
            : "border-line text-dim hover:border-accent/50 hover:text-accent"
        }
        ${pending ? "cursor-wait opacity-60" : "cursor-pointer"}
      `}
    >
      <svg
        className={iconSize}
        fill={isFilled ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={isFilled ? 0 : 1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 3H7a2 2 0 0 0-2 2v16l7-4 7 4V5a2 2 0 0 0-2-2Z"
        />
      </svg>
    </button>
  );
}
