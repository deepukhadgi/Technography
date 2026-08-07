"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  slug: string;
  title: string;
  excerpt: string;
  date: string | null;
  tags: string[];
};

type SearchModalProps = {
  /**
   * Controlled open state (optional). When omitted the modal self-manages:
   * it opens on ⌘K / Ctrl+K and closes on Esc / backdrop click / selection.
   * A parent (e.g. SiteNav) can pass isOpen + onClose to drive it instead.
   */
  isOpen?: boolean;
  /** Called when the modal wants to close (Esc, backdrop click, selection). */
  onClose?: () => void;
};

const MIN_QUERY_LENGTH = 1;
const DEBOUNCE_MS = 250;
const RESULTS_LIMIT = 8;

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Render off the prop when provided (controlled), otherwise internal state.
  const open = isOpen ?? internalOpen;

  const close = useCallback(() => {
    setInternalOpen(false);
    onClose?.();
  }, [onClose]);

  const selectResult = useCallback(
    (r: SearchResult) => {
      close();
      router.push(`/blog/${r.slug}`);
    },
    [close, router],
  );

  /* Global ⌘K / Ctrl+K shortcut. preventDefault stops Firefox from focusing
   * its own search bar / the browser address bar. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInternalOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Fresh slate every time the modal opens. */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setActiveIdx(-1);
    setError(null);
    setLoading(false);
  }, [open]);

  /* Lock body scroll while open, restore on close. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Focus the input on open; hand focus back on close. */
  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
    } else if (lastFocusedRef.current) {
      lastFocusedRef.current.focus?.();
      lastFocusedRef.current = null;
    }
  }, [open]);

  /* Esc closes from anywhere while open. */
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  /* Debounced search with in-flight request cancellation. */
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      setLoading(false);
      setActiveIdx(-1);
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${RESULTS_LIMIT}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`search failed: ${res.status}`);
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results);
          setActiveIdx(-1);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError("search unavailable");
          setResults([]);
        })
        .finally(() => {
          // Only the latest request may clear the spinner.
          if (abortRef.current === controller) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  /* Keep the highlighted result in view when navigating with the arrows. */
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (!open) return null;

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length > 0) setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length > 0) {
        setActiveIdx((i) => (i - 1 + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = activeIdx >= 0 ? results[activeIdx] : results[0];
      if (target) selectResult(target);
    }
  }

  const hasQuery = query.trim().length >= MIN_QUERY_LENGTH;
  const showEmpty = !loading && !error && hasQuery && results.length === 0;
  const hint = (
    <span className="shrink-0 rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-dim">
      esc to close
    </span>
  );

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search posts"
    >
      <div className="mx-auto mt-[10vh] w-full max-w-xl overflow-hidden rounded-lg border border-line bg-bg shadow-2xl">
        {/* input row */}
        <div className="flex items-center gap-3 border-b border-line px-4">
          <span aria-hidden className="font-mono text-sm text-dim">
            ⌕
          </span>
          <input
            ref={inputRef}
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search posts…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search posts"
            aria-expanded={results.length > 0}
            aria-controls="search-modal-results"
            aria-activedescendant={
              activeIdx >= 0 ? `search-result-${activeIdx}` : undefined
            }
            className="h-14 min-w-0 flex-1 bg-transparent font-mono text-base text-fg placeholder:text-dim/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {hint}
        </div>

        {/* results / states */}
        {loading && (
          <div className="flex items-center gap-3 px-4 py-6">
            <Spinner />
            <p className="font-mono text-sm text-dim">searching…</p>
          </div>
        )}

        {!loading && error && (
          <p className="px-4 py-6 font-mono text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && !hasQuery && (
          <p className="px-4 py-6 font-mono text-sm text-dim">
            start typing to search posts…
          </p>
        )}

        {showEmpty && (
          <p className="px-4 py-6 font-mono text-sm text-dim">
            no results for “{query.trim()}”
          </p>
        )}

        {!loading && !error && hasQuery && results.length > 0 && (
          <ul
            id="search-modal-results"
            ref={listRef}
            role="listbox"
            aria-label="Search results"
            className="max-h-[50vh] divide-y divide-line/50 overflow-y-auto"
          >
            {results.map((r, i) => {
              const active = i === activeIdx;
              return (
                <li
                  key={r.slug}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={active}
                >
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => selectResult(r)}
                    className={`block w-full px-4 py-3 text-left transition-colors ${
                      active ? "bg-accent/10" : "hover:bg-accent/5"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-sm font-bold text-fg">
                        {r.title}
                      </span>
                      {r.date && (
                        <time className="shrink-0 font-mono text-[10px] text-dim">
                          {r.date}
                        </time>
                      )}
                    </span>
                    {r.excerpt && (
                      <span className="mt-1 line-clamp-2 block text-xs text-dim">
                        {r.excerpt}
                      </span>
                    )}
                    {r.tags.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-dim/80"
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* footer hint */}
        {!loading && !error && hasQuery && results.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2 font-mono text-[10px] text-dim">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate · <Kbd>enter</Kbd> open ·{" "}
              <Kbd>esc</Kbd> close
            </span>
            <span className="text-dim/60">⌘K</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent"
    />
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line px-1 font-mono text-[10px] text-fg/80">
      {children}
    </kbd>
  );
}
