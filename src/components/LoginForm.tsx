"use client";

import { useState, type FormEvent } from "react";

/** Only allow same-origin relative redirects (never "//host" or "http…"). */
function safeNextPath(raw: string | undefined | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

type Step = "password" | "totp";

export default function LoginForm({
  nextPath = "/",
}: {
  nextPath?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<Step>("password");
  const [code, setCode] = useState("");
  const [temporaryToken, setTemporaryToken] = useState("");

  function finishLogin(firstName: string | null | undefined) {
    setSuccess(true);
    // Stash the welcome message so the global WelcomeToast can show it
    // on the destination page after the redirect (full page load would
    // otherwise kill an inline toast immediately).
    sessionStorage.setItem(
      "welcome_toast",
      firstName && firstName.length > 0 ? `Welcome back, ${firstName}!` : "Welcome back!"
    );
    const dest = safeNextPath(nextPath);
    setTimeout(() => (window.location.href = dest), 800);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, hp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
      } else if (data.requires2fa === true && typeof data.temporaryToken === "string") {
        // Password was correct — now prompt for the authenticator code.
        setTemporaryToken(data.temporaryToken);
        setStep("totp");
      } else {
        finishLogin(data.firstName);
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, temporaryToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
      } else {
        finishLogin(data.firstName);
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setStep("password");
    setCode("");
    setTemporaryToken("");
    setError("");
  }

  if (success) {
    return (
      <div className="rounded border border-green-500/40 bg-green-500/10 p-4 text-center text-sm text-green-400">
        ✓ Logged in — redirecting...
      </div>
    );
  }

  if (step === "totp") {
    return (
      <form onSubmit={handleTotpSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block font-mono text-xs text-dim">
            authenticator code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base tracking-[0.5em] text-fg outline-none transition-colors focus:border-accent"
            placeholder="000000"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full rounded border border-accent/60 bg-accent/10 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
        >
          {loading ? "verifying..." : "verify →"}
        </button>

        <p className="text-center">
          <button
            type="button"
            onClick={restart}
            className="font-mono text-xs text-dim underline hover:text-accent"
          >
            ← back to password
          </button>
        </p>
      </form>
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
        <label htmlFor="email" className="block font-mono text-xs text-dim">
          email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base text-fg outline-none transition-colors focus:border-accent"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block font-mono text-xs text-dim">
          password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-line bg-panel px-3 py-3 font-mono text-base text-fg outline-none transition-colors focus:border-accent"
          placeholder="min 8 characters"
        />
      </div>

      <p className="text-right">
        <a
          href="/forgot-password"
          className="text-xs font-mono text-dim underline hover:text-accent"
        >
          Forgot password?
        </a>
      </p>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded border border-accent/60 bg-accent/10 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
      >
        {loading ? "logging in..." : "login →"}
      </button>
    </form>
  );
}
