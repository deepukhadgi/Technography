import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Email verified" };

export default function VerifiedPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> echo $EMAIL_VERIFIED
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Email <span className="text-accent">verified</span> ✓
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        Your account is verified. You can now close this tab — full account
        features (like signing in to comment) are on the roadmap.
      </p>
      <p className="mt-8">
        <Link
          href="/"
          className="rounded border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent/20"
        >
          ← back home
        </Link>
      </p>
    </div>
  );
}
