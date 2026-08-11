import type { Metadata } from "next";
import Link from "next/link";
import { fetchCampaigns, type Campaign } from "@/lib/newsletter";

export const metadata: Metadata = {
  title: "Newsletter Archive",
  description:
    "Archive of past Technography digest campaigns — previously sent by email, collected here.",
};

export default async function NewsletterPage() {
  let campaigns: Campaign[] = [];
  let failed = false;

  try {
    campaigns = await fetchCampaigns();
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link
        href="/"
        className="inline-block py-2 font-mono text-xs text-dim hover:text-accent"
      >
        ← back
      </Link>

      <p className="mt-6 font-mono text-sm text-dim">
        <span className="text-accent">$</span> cat ./newsletter/archive
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Newsletter <span className="text-accent">Archive</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        Past Listmonk digest campaigns, collected here for reference.
      </p>

      {failed ? (
        <div className="mt-10 rounded border border-line bg-panel p-6">
          <p className="font-mono text-xs text-dim">
            <span className="text-accent">$</span> mail --list
          </p>
          <h2 className="mt-3 font-mono text-xl font-bold">
            Newsletter archive coming soon
          </h2>
          <p className="mt-3 text-sm text-dim">
            The Listmonk service is currently unavailable — check back soon.
          </p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mt-10 rounded border border-line bg-panel p-6">
          <p className="font-mono text-xs text-dim">
            <span className="text-accent">$</span> ls ./issues
          </p>
          <h2 className="mt-3 font-mono text-xl font-bold">
            No newsletters yet
          </h2>
          <p className="mt-3 text-sm text-dim">
            The first digest hasn&apos;t been sent yet.{" "}
            <Link
              href="/"
              className="text-accent hover:underline"
            >
              Subscribe
            </Link>{" "}
            to be notified when it drops.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded border border-line bg-panel p-5"
            >
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-dim">
                <time dateTime={c.date}>{c.date}</time>
                <span className="rounded border border-line px-2 py-0.5 text-[10px] text-dim/80">
                  {c.sent > 0 ? `${c.sent} sent` : "draft"}
                </span>
              </div>
              <h2 className="mt-2 font-mono text-base font-bold">
                {c.title}
              </h2>
              <div className="mt-3">
                <Link
                  href={c.archiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded border border-accent/60 bg-accent/10 px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
                >
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
