import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Archive of past Technography newsletter issues — previously sent by email, collected here.",
};

type Campaign = {
  id: number;
  subject: string;
  body?: string;
  started_at?: string | null;
  updated_at?: string | null;
};

type ListmonkResponse = {
  data?: unknown;
};

const LISTMONK_URL = process.env.LISTMONK_URL;
const LISTMONK_USER = process.env.LISTMONK_USER;
const LISTMONK_TOKEN = process.env.LISTMONK_TOKEN;

/** Strip HTML tags and decode the common entities Listmonk emails contain. */
function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain-text excerpt of a campaign body, capped at ~200 chars. */
function excerptOf(body: string | undefined, max = 200): string {
  const text = stripHtml(body ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchSentCampaigns(): Promise<Campaign[]> {
  if (!LISTMONK_URL || !LISTMONK_USER || !LISTMONK_TOKEN) {
    throw new Error("Listmonk not configured");
  }
  const base = LISTMONK_URL.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/campaigns?status=sent&per_page=50`, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${LISTMONK_USER}:${LISTMONK_TOKEN}`
      ).toString("base64")}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Listmonk API error: ${res.status}`);
  }
  const json = (await res.json()) as ListmonkResponse;
  const data = Array.isArray(json.data) ? (json.data as Campaign[]) : [];
  return data.sort((a, b) => {
    const da = a.started_at ?? a.updated_at ?? "";
    const db = b.started_at ?? b.updated_at ?? "";
    return da < db ? 1 : da > db ? -1 : 0;
  });
}

export default async function NewsletterPage() {
  let campaigns: Campaign[] = [];
  let failed = false;

  try {
    campaigns = await fetchSentCampaigns();
  } catch {
    failed = true;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link
        href="/blog"
        className="inline-block py-2 font-mono text-xs text-dim hover:text-accent"
      >
        ← back to blog
      </Link>

      <p className="mt-6 font-mono text-sm text-dim">
        <span className="text-accent">$</span> cat ./newsletter
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Newsletter <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        Past issues of the Technography newsletter, straight from the archive.
      </p>

      {failed ? (
        <div className="mt-10 rounded border border-line bg-panel p-6">
          <p className="font-mono text-xs text-dim">
            <span className="text-accent">$</span> mail --list
          </p>
          <h2 className="mt-3 font-mono text-xl font-bold">
            Archive unavailable
          </h2>
          <p className="mt-3 text-sm text-dim">
            The newsletter archive is temporarily unavailable — check back
            soon.
          </p>
        </div>
      ) : campaigns.length === 0 ? (
        <p className="mt-10 text-sm text-dim">
          No issues published yet — the first one is brewing.
        </p>
      ) : (
        <div className="mt-10 space-y-4">
          {campaigns.map((c) => {
            const sent = formatDate(c.started_at ?? c.updated_at);
            const excerpt = excerptOf(c.body);
            return (
              <div
                key={c.id}
                className="rounded border border-line bg-panel p-5"
              >
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-dim">
                  {sent ? (
                    <time
                      dateTime={c.started_at ?? c.updated_at ?? undefined}
                    >
                      {sent}
                    </time>
                  ) : null}
                  <span className="rounded border border-line px-2 py-0.5 text-[10px] text-dim/80">
                    issue
                  </span>
                </div>
                <h2 className="mt-2 font-mono text-base font-bold">
                  {c.subject || "Untitled issue"}
                </h2>
                {excerpt ? (
                  <p className="mt-2 text-sm text-dim">{excerpt}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
