import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Verification failed" };

export default function ErrorPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> cat /var/log/verify.log
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Verification <span className="text-accent">failed</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        This link is invalid or has expired. If you still want an account, try
        signing up again — a fresh verification email will be sent.
      </p>
      <p className="mt-8">
        <Link
          href="/signup"
          className="rounded border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent/20"
        >
          ← sign up again
        </Link>
      </p>
    </div>
  );
}
