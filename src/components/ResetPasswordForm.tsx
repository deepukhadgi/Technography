"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Check token presence on mount
  useEffect(() => {
    if (!token) {
      setError("Missing or invalid reset token. Please request a new reset link.");
    }
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 1500);
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
        ✓ Password reset successful — redirecting to login...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block text-xs font-mono text-dim mb-1"
        >
          new password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-line bg-bg px-3 py-2.5 text-base font-mono text-fg placeholder:text-dim/40 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
          disabled={loading || !token}
          required
          minLength={8}
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-xs font-mono text-dim mb-1"
        >
          confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded border border-line bg-bg px-3 py-2.5 text-base font-mono text-fg placeholder:text-dim/40 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
          disabled={loading || !token}
          required
          minLength={8}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !token}
        className="w-full rounded border border-accent/50 bg-accent/10 px-4 py-2.5 text-sm font-mono text-accent transition-colors hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Resetting..." : "Reset password"}
      </button>

      <p className="text-center text-xs text-dim">
        <a href="/login" className="underline hover:text-accent">
          ← Back to login
        </a>
      </p>
    </form>
  );
}