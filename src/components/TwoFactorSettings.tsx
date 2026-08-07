"use client";

import { useState } from "react";

type Phase = "idle" | "setup" | "disabling";

/**
 * Client-side 2FA management for the settings page.
 *
 * Enable flow:  POST /api/auth/2fa/setup  → QR + secret shown, NOT saved yet
 *               POST /api/auth/2fa/verify { token, secret } → persisted
 * Disable flow: POST /api/auth/2fa/disable { code } → totp_secret cleared
 */
export default function TwoFactorSettings({
  initiallyEnabled,
  email,
}: {
  initiallyEnabled: boolean;
  email: string;
}) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start setup");
        return;
      }
      setSecret(data.secret);
      setQrDataUrl(data.qrDataUrl);
      setSetupCode("");
      setPhase("setup");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: setupCode, secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      setEnabled(true);
      setPhase("idle");
      setSecret("");
      setQrDataUrl("");
      setSetupCode("");
      setMessage("Two-factor authentication enabled.");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      setEnabled(false);
      setPhase("idle");
      setDisableCode("");
      setMessage("Two-factor authentication disabled.");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    setPhase("idle");
    setError("");
    setSecret("");
    setQrDataUrl("");
    setSetupCode("");
    setDisableCode("");
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="font-mono text-sm">
        status:{" "}
        <span className={enabled ? "text-green-400" : "text-dim"}>
          {enabled ? "enabled" : "disabled"}
        </span>
      </p>

      {message && (
        <p className="text-sm text-green-400">{message}</p>
      )}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {phase === "idle" && (
        <div>
          {enabled ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setMessage("");
                setDisableCode("");
                setPhase("disabling");
              }}
              className="rounded border border-red-500/60 bg-red-500/10 px-4 py-2 font-mono text-sm text-red-400 transition-colors hover:bg-red-500 hover:text-bg"
            >
              Disable 2FA
            </button>
          ) : (
            <button
              type="button"
              onClick={startSetup}
              disabled={loading}
              className="rounded border border-accent/60 bg-accent/10 px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
            >
              {loading ? "starting..." : "Enable 2FA"}
            </button>
          )}
        </div>
      )}

      {phase === "setup" && (
        <div className="space-y-4">
          <p className="text-sm text-dim">
            Scan this QR code with your authenticator app (Google Authenticator,
            Authy, 1Password, …), then enter the 6-digit code it shows to confirm.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR code for ${email} — scan with your authenticator app`}
            width={240}
            height={240}
            className="rounded border border-line bg-white p-2"
          />
          <div>
            <p className="font-mono text-xs text-dim">or enter this key manually</p>
            <p className="mt-1 break-all font-mono text-sm text-fg">{secret}</p>
          </div>
          <form onSubmit={confirmSetup} className="space-y-3">
            <div>
              <label htmlFor="setup-code" className="block font-mono text-xs text-dim">
                6-digit code
              </label>
              <input
                id="setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full max-w-[12rem] rounded border border-line bg-panel px-3 py-2 font-mono text-base tracking-[0.5em] text-fg outline-none transition-colors focus:border-accent"
                placeholder="000000"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || setupCode.length !== 6}
                className="rounded border border-accent/60 bg-accent/10 px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
              >
                {loading ? "verifying..." : "Verify & enable"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="rounded border border-line px-4 py-2 font-mono text-sm text-dim transition-colors hover:border-accent/60 hover:text-accent"
              >
                cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {phase === "disabling" && (
        <div className="space-y-4">
          <p className="text-sm text-dim">
            Enter a current code from your authenticator app to disable
            two-factor authentication.
          </p>
          <form onSubmit={confirmDisable} className="space-y-3">
            <div>
              <label htmlFor="disable-code" className="block font-mono text-xs text-dim">
                6-digit code
              </label>
              <input
                id="disable-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full max-w-[12rem] rounded border border-line bg-panel px-3 py-2 font-mono text-base tracking-[0.5em] text-fg outline-none transition-colors focus:border-accent"
                placeholder="000000"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || disableCode.length !== 6}
                className="rounded border border-red-500/60 bg-red-500/10 px-4 py-2 font-mono text-sm text-red-400 transition-colors hover:bg-red-500 hover:text-bg disabled:opacity-50"
              >
                {loading ? "disabling..." : "Disable 2FA"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="rounded border border-line px-4 py-2 font-mono text-sm text-dim transition-colors hover:border-accent/60 hover:text-accent"
              >
                cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
