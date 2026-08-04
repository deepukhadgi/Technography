"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const baseLinks = [
  { href: "/", label: "home" },
  { href: "/about", label: "about" },
  { href: "/blog", label: "blog" },
  { href: "/contact", label: "contact" },
];

const authLinks = [
  { href: "/signup", label: "signup" },
  { href: "/login", label: "login" },
];

/**
 * Client nav that shows auth state: calls /api/auth/me once on mount.
 * Logged-in users see a "logout" action instead of signup/login.
 * (The layout stays a static server component — no cookies() in layout,
 * so public pages keep their SSG rendering.)
 *
 * `onNavigate` is optional: used by the mobile menu to close the panel
 * after a link is tapped. Auth logic is otherwise untouched.
 */
export default function AuthNav({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setLoggedIn(data?.loggedIn === true);
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore — session cookie may already be gone; still navigate away
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-5">
      {baseLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          className="py-3 text-dim transition-colors hover:text-accent sm:py-0"
        >
          {l.label}
        </Link>
      ))}
      {loggedIn === null ? (
        <span className="py-3 text-xs text-dim/60 sm:py-0">…</span>
      ) : loggedIn ? (
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            void handleLogout();
          }}
          disabled={loggingOut}
          className="py-3 text-dim transition-colors hover:text-accent disabled:opacity-50 sm:py-0"
        >
          {loggingOut ? "logging out..." : "logout"}
        </button>
      ) : (
        authLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            className="py-3 text-dim transition-colors hover:text-accent sm:py-0"
          >
            {l.label}
          </Link>
        ))
      )}
    </div>
  );
}
