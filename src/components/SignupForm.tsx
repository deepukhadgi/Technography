"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError("enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, hp }),
      });
      if (res.status === 429) {
        setError("too many attempts — try again later");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "something went wrong — try again");
        return;
      }
      setDone(true);
    } catch {
      setError("could not reach the server — try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 rounded border border-line bg-panel p-6 font-mono text-sm">
        <p className="text-accent">✓ account created</p>
        <p className="mt-2 text-dim">
          check your inbox for a verification link (it expires in 24 hours).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 max-w-md">
      {/* honeypot — humans never see or fill this */}
      <input
        type="text"
        name="hp"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />

      <label className="block font-mono text-xs text-dim" htmlFor="s-email">
        email
      </label>
      <input
        id="s-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="mt-1 w-full rounded border border-line bg-panel px-3 py-2 font-mono text-sm text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
      />

      <label className="mt-4 block font-mono text-xs text-dim" htmlFor="s-password">
        password
      </label>
      <input
        id="s-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="8+ characters"
        className="mt-1 w-full rounded border border-line bg-panel px-3 py-2 font-mono text-sm text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
      />

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded border border-accent/40 bg-accent/10 px-4 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "creating…" : "create account"}
        </button>
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      </div>
    </form>
  );
}
