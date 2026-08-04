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
 */
export default function AuthNav() {
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
    <div className="flex items-center gap-5">
      {baseLinks.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="text-dim transition-colors hover:text-accent"
        >
          {l.label}
        </Link>
      ))}
      {loggedIn === null ? (
        <span className="text-xs text-dim/60">…</span>
      ) : loggedIn ? (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="text-dim transition-colors hover:text-accent disabled:opacity-50"
        >
          {loggingOut ? "logging out..." : "logout"}
        </button>
      ) : (
        authLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-dim transition-colors hover:text-accent"
          >
            {l.label}
          </Link>
        ))
      )}
    </div>
  );
}
