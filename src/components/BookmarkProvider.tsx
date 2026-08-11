"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type BookmarkState = {
  bookmarks: Set<string>;
  loading: boolean;
  toggleBookmark: (slug: string) => Promise<void>;
  isBookmarked: (slug: string) => boolean;
};

const BookmarkContext = createContext<BookmarkState | null>(null);

export function useBookmarkContext() {
  const ctx = useContext(BookmarkContext);
  if (!ctx) throw new Error("useBookmarkContext must be used within BookmarkProvider");
  return ctx;
}

/**
 * Hook: returns { isBookmarked, toggleBookmark } for a given slug.
 * toggleBookmark is a no-op if the user is not logged in.
 */
export function useBookmark(slug: string) {
  const ctx = useBookmarkContext();
  return {
    isBookmarked: ctx.isBookmarked(slug),
    toggleBookmark: () => ctx.toggleBookmark(slug),
  };
}

export default function BookmarkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookmarks")
      .then((r) => {
        if (!cancelled) {
          if (r.ok) {
            return r.json() as Promise<{ bookmarks: { slug: string }[] }>;
          }
          // Not logged in — empty set is fine
          return { bookmarks: [] } as { bookmarks: { slug: string }[] };
        }
        return { bookmarks: [] };
      })
      .then((data) => {
        if (!cancelled) {
          setBookmarks(new Set(data.bookmarks.map((b) => b.slug)));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleBookmark = useCallback(async (slug: string) => {
    // Optimistically update state
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });

    // Remember the intended direction before the async call
    const willAdd = !bookmarks.has(slug);

    try {
      const res = await fetch("/api/bookmarks", {
        method: willAdd ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: willAdd ? JSON.stringify({ slug }) : undefined,
      });

      if (!res.ok) {
        // Revert on failure
        setBookmarks((prev) => {
          const revert = new Set(prev);
          if (willAdd) {
            revert.delete(slug);
          } else {
            revert.add(slug);
          }
          return revert;
        });
      }
    } catch {
      // Revert on network error
      setBookmarks((prev) => {
        const revert = new Set(prev);
        if (willAdd) {
          revert.delete(slug);
        } else {
          revert.add(slug);
        }
        return revert;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarks]);

  const isBookmarked = useCallback(
    (slug: string) => bookmarks.has(slug),
    [bookmarks]
  );

  return (
    <BookmarkContext.Provider
      value={{ bookmarks, loading, toggleBookmark, isBookmarked }}
    >
      {children}
    </BookmarkContext.Provider>
  );
}
