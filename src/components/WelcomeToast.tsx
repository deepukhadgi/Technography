"use client";

import { useEffect, useState } from "react";

export default function WelcomeToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Message was stashed in sessionStorage before the redirect, so it
    // survives the page reload and shows on the destination page.
    const msg = sessionStorage.getItem("welcome_toast");
    if (msg) {
      setMessage(msg);
      sessionStorage.removeItem("welcome_toast");
    }
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 10000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-[100] rounded border border-accent/50 bg-accent/10 p-3 text-sm font-mono text-accent shadow-lg"
    >
      {message}
    </div>
  );
}