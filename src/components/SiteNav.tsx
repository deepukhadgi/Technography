"use client";

import Link from "next/link";
import { useState } from "react";
import AuthNav from "@/components/AuthNav";

/**
 * Responsive site nav (client): brand + hamburger toggle on mobile, full
 * inline nav from sm up. AuthNav stays a single instance (auth state
 * fetched once); on small screens its links live in a collapsible panel
 * below the brand row. Auth client logic is untouched.
 */
export default function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 px-4 py-3 font-mono text-sm">
      <Link
        href="/"
        className="font-bold tracking-tight"
        onClick={() => setOpen(false)}
      >
        <span className="text-accent">deepu</span>
        <span className="text-dim">@</span>
        <span className="text-fg">dev</span>
        <span className="text-dim">:~$</span>
      </Link>

      {/* mobile menu toggle (44px tap target); hidden from sm up */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="site-nav-links"
        aria-label="toggle menu"
        className="flex h-11 w-11 items-center justify-center rounded border border-line text-dim transition-colors hover:border-accent/50 hover:text-accent sm:hidden"
      >
        <span aria-hidden className="text-lg leading-none">
          {open ? "✕" : "☰"}
        </span>
      </button>

      {/* search trigger — icon-only on mobile, icon+⌘K label on sm+ */}
      <button
        type="button"
        aria-label="search"
        className="flex h-11 w-11 items-center justify-center rounded border border-line text-dim transition-colors hover:border-accent/50 hover:text-accent sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden font-mono text-xs sm:inline">⌘K</span>
      </button>

      {/* links panel: collapsible below brand on mobile, inline row on sm+ */}
      <div
        id="site-nav-links"
        className={`${
          open ? "flex" : "hidden"
        } w-full flex-col gap-1 border-t border-line pb-1 pt-3 sm:flex sm:w-auto sm:flex-row sm:items-center sm:gap-5 sm:border-0 sm:pb-0 sm:pt-0`}
      >
        <AuthNav onNavigate={() => setOpen(false)} />
        <Link
          href="/newsletter"
          onClick={() => setOpen(false)}
          className="py-3 text-dim transition-colors hover:text-accent sm:py-0"
        >
          newsletter
        </Link>
      </div>
    </nav>
  );
}
