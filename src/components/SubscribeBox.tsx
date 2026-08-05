"use client";

import { useState, type FormEvent } from "react";

export default function SubscribeBox() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [hp, setHp] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, hp }),
      });
      if (res.ok) {
        setStatus("done");
        setEmail("");
        setName("");
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not subscribe.");
        setStatus("error");
      }
    } catch {
      setError("Could not subscribe.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="font-mono text-xs text-green-400">
        ✓ subscribed — check your inbox to confirm
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      {/* honeypot */}
      <input
        type="text"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        maxLength={200}
        placeholder="you@example.com"
        aria-label="Email"
        className="min-w-0 flex-1 rounded border border-line bg-bg px-3 py-2 font-mono text-sm text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded border border-accent/40 bg-accent/10 px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "subscribing…" : "subscribe"}
      </button>
      {status === "error" && (
        <span className="font-mono text-xs text-red-400">{error}</span>
      )}
    </form>
  );
}