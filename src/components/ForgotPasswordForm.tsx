"use client";

import { useState, type FormEvent } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, hp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded border border-green-500/40 bg-green-500/10 p-4 text-center text-sm text-green-400">
        ✓ If an account exists with that email, a password reset link has been sent.
        <p className="mt-2 text-xs text-green-300">
          Check your inbox (and spam folder). The link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot */}
      <input
        type="text"
        name="hp"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-mono text-dim mb-1"
        >
          email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded border border-line bg-bg px-3 py-2.5 text-base font-mono text-fg placeholder:text-dim/40 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
          disabled={loading}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded border border-accent/50 bg-accent/10 px-4 py-2.5 text-sm font-mono text-accent transition-colors hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Sending..." : "Send reset link"}
      </button>

      <p className="text-center text-xs text-dim">
        <a href="/login" className="underline hover:text-accent">
          ← Back to login
        </a>
      </p>
    </form>
  );
}