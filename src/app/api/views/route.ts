import { NextRequest } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/**
 * Post view counter backed by PostgreSQL.
 *
 * DATABASE_URL is read from process.env (`.env.local`) at runtime — never
 * commit real credentials; `.env.example` only carries placeholders, e.g.
 *   postgresql://USER:PASSWORD@YOUR_DB_HOST:5433/technography
 *
 * Expected schema (created once, idempotent):
 *   CREATE TABLE IF NOT EXISTS post_views (
 *     slug       TEXT PRIMARY KEY,
 *     view_count INTEGER NOT NULL DEFAULT 0
 *   );
 */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set in .env.local (placeholder: postgresql://USER:PASSWORD@YOUR_DB_HOST:5433/technography)"
  );
}

// Module-level pool: created once per cold start, reused across requests.
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

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

type ViewRow = { view_count: number };

/** Coerce pg's value to a number (int8 may arrive as a string). */
function toViews(value: number | string | null): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

/** GET /api/views?slug=my-post → { views: number } */
export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  if (!slug || slug.length > 200) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }
  if (isRateLimited(clientIp(req))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const result = await pool.query<ViewRow>(
      "SELECT view_count FROM post_views WHERE slug = $1",
      [slug]
    );
    const views = result.rowCount === 0 ? 0 : toViews(result.rows[0].view_count);
    return Response.json({ views });
  } catch (err) {
    console.error("GET /api/views error", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/views with body { slug } → increments and returns { views: number } */
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawSlug = (payload as { slug?: unknown } | null)?.slug;
  const slug = typeof rawSlug === "string" ? rawSlug.trim() : "";
  if (!slug || slug.length > 200) {
    return Response.json({ error: "slug must be a string of 1-200 characters" }, { status: 400 });
  }
  if (isRateLimited(clientIp(req))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const result = await pool.query<ViewRow>(
      `INSERT INTO post_views (slug, view_count)
       VALUES ($1, 1)
       ON CONFLICT (slug)
       DO UPDATE SET view_count = post_views.view_count + 1
       RETURNING view_count`,
      [slug]
    );
    return Response.json({ views: toViews(result.rows[0].view_count) });
  } catch (err) {
    console.error("POST /api/views error", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
