import { NextRequest } from "next/server";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Server-side proxy to Meilisearch. The client never sees MEILI_HOST or
 * MEILI_MASTER_KEY — both are read from process.env (`.env.local`) here.
 *
 * MEILI_HOST / MEILI_MASTER_KEY must be set in .env.local (never commit them;
 * `.env.example` only carries placeholders). Example values:
 *   MEILI_HOST=http://YOUR_SEARCH_HOST:7700
 *   MEILI_MASTER_KEY=<your-master-key>
 */
const MEILI_HOST = process.env.MEILI_HOST ?? (() => { throw new Error("MEILI_HOST must be set in .env.local — never use the default fallback"); })();
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY ?? (() => { throw new Error("MEILI_MASTER_KEY must be set in .env.local — never use the default fallback"); })();

type Hit = {
  slug: string;
  title?: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
};

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

/* --- simple in-memory rate limiting (per process; fine for a single
 * standalone server). Sliding window of RATE_MAX requests per IP. --- */
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 30;
const rateBuckets = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;

  // Opportunistic prune so the map cannot grow unboundedly.
  if (rateBuckets.size > 1000) {
    for (const [key, times] of rateBuckets) {
      const last = times[times.length - 1];
      if (last === undefined || last < cutoff) rateBuckets.delete(key);
    }
  }

  const recent = (rateBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) {
    rateBuckets.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateBuckets.set(ip, recent);
  return false;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    return Response.json({ results: [] });
  }
  if (q.length > 100) {
    return Response.json({ error: "Query too long" }, { status: 400 });
  }
  if (isRateLimited(clientIp(req))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!MEILI_MASTER_KEY) {
    return Response.json({ error: "Search not configured" }, { status: 503 });
  }

  const rawLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
  const limit = Number.isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

  try {
    const res = await fetch(`${MEILI_HOST}/indexes/posts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MEILI_MASTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q,
        limit,
        attributesToSearchOn: ["title", "excerpt", "tags"],
        attributesToRetrieve: ["slug", "title", "excerpt", "date", "tags"],
        highlightPreTag: "<mark>",
        highlightPostTag: "</mark>",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Meilisearch error", res.status);
      return Response.json({ error: "Search unavailable" }, { status: 502 });
    }

    const data = (await res.json()) as {
      hits: (Hit & { _formatted?: Partial<Record<"title" | "excerpt", string>> })[];
    };

    const results = data.hits.map((h) => ({
      slug: h.slug,
      title: h._formatted?.title ?? h.title ?? h.slug,
      excerpt: h._formatted?.excerpt ?? h.excerpt ?? "",
      date: h.date ?? null,
      tags: h.tags ?? [],
    }));

    return Response.json({ results });
  } catch (err) {
    console.error("Search proxy error", err);
    return Response.json({ error: "Search unavailable" }, { status: 502 });
  }
}
