"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
    if (!firstName.trim()) {
      setError("first name is required");
      return;
    }
    if (!lastName.trim()) {
      setError("last name is required");
      return;
    }
    if (password.length < 8) {
      setError("password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          confirmPassword,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          hp,
        }),
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-xs text-dim" htmlFor="s-first-name">
            first name
          </label>
          <input
            id="s-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
            placeholder="John"
            className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-dim" htmlFor="s-last-name">
            last name
          </label>
          <input
            id="s-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
            placeholder="Doe"
            className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <label className="mt-4 block font-mono text-xs text-dim" htmlFor="s-email">
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
        className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
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
        className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
      />

      <label className="mt-4 block font-mono text-xs text-dim" htmlFor="s-confirm-password">
        confirm password
      </label>
      <input
        id="s-confirm-password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="repeat password"
        className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
      />

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded border border-accent/60 bg-accent/10 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
      >
        {submitting ? "creating..." : "create account →"}
      </button>

      <p className="mt-4 text-center text-xs text-dim">
        already have an account?{" "}
        <a href="/login" className="underline hover:text-accent">
          login
        </a>
      </p>
    </form>
  );
}