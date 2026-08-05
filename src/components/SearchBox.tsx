"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type SearchResult = {
  slug: string;
  title: string;
  excerpt: string;
  date: string | null;
  tags: string[];
};

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        setError("search unavailable");
        setResults([]);
        return;
      }
      const data = (await res.json()) as { results: SearchResult[] };
      setResults(data.results);
      setActiveIdx(-1);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("search unavailable");
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setOpen(true);
    const t = setTimeout(() => void doSearch(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  // Close when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) {
        e.preventDefault();
        const r = results[activeIdx];
        if (r) window.location.href = `/blog/${r.slug}`;
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full sm:w-72">
      <label htmlFor="site-search" className="sr-only">
        Search posts
      </label>
      <div className="relative">
        <input
          id="site-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="search posts…"
          autoComplete="off"
          aria-expanded={open}
          aria-controls="search-results"
          className="w-full rounded border border-line bg-panel/60 px-3 py-2 pl-8 font-mono text-sm text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
        />
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-dim">
          ⌕
        </span>
      </div>

      {open && (
        <div
          id="search-results"
          className="absolute right-0 top-full z-50 mt-2 w-full min-w-[16rem] overflow-hidden rounded border border-line bg-panel shadow-xl"
        >
          {loading && (
            <p className="px-4 py-3 font-mono text-xs text-dim">searching…</p>
          )}
          {!loading && error && (
            <p className="px-4 py-3 font-mono text-xs text-red-400">{error}</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-3 font-mono text-xs text-dim">
              no results for “{query}”
            </p>
          )}
          {!loading &&
            !error &&
            results.map((r, i) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => setOpen(false)}
                className={`block border-b border-line/50 px-4 py-3 transition-colors last:border-b-0 ${
                  i === activeIdx ? "bg-accent/10" : "hover:bg-accent/5"
                }`}
              >
                <span className="block font-mono text-sm text-fg">
                  {r.title}
                </span>
                {r.excerpt && (
                  <span className="mt-1 line-clamp-2 block text-xs text-dim">
                    {r.excerpt}
                  </span>
                )}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}