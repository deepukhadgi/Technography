import { NextRequest } from "next/server";
import { getAllPosts, getAllTags } from "@/lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public infrastructure stats endpoint.
 *
 * Aggregates non-sensitive metrics from:
 * - Blog content (post count, tags)
 * - Umami analytics (total visits, pageviews — public API)
 * - Listmonk (subscriber count — server-side auth, count only)
 *
 * No internal IPs, credentials, or sensitive data exposed.
 */

// --- Blog stats -------------------------------------------------------------
function getBlogStats() {
  const posts = getAllPosts();
  const tags = getAllTags();
  const publishedPosts = posts.filter((p) => !p.premium);
  const premiumPosts = posts.filter((p) => p.premium);

  return {
    posts: {
      total: posts.length,
      published: publishedPosts.length,
      premium: premiumPosts.length,
    },
    tags: {
      count: tags.length,
      list: tags,
    },
  };
}

// --- Umami stats (public API) ----------------------------------------------
async function getUmamiStats(): Promise<{
  visitors: number | null;
  pageviews: number | null;
  available: boolean;
}> {
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL;
  const websiteId = process.env.UMAMI_WEBSITE_ID;

  // Only attempt if both URL and website ID are configured
  if (!umamiUrl || !websiteId) {
    return { visitors: null, pageviews: null, available: false };
  }

  try {
    // Umami public stats API: /api/websites/:websiteId/stats
    // Supports ?startAt=&endAt=&type= (e.g., visitors, pageviews)
    // We fetch the last 30 days by default.
    const endAt = Date.now();
    const startAt = endAt - 30 * 24 * 60 * 60 * 1000;

    const base = umamiUrl.replace(/\/+$/, "");
    const url = `${base}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      // Short timeout to avoid blocking the response
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      console.warn(`Umami stats API error: ${res.status}`);
      return { visitors: null, pageviews: null, available: false };
    }

    const data = (await res.json()) as {
      visitors?: { value: number };
      pageviews?: { value: number };
    };

    return {
      visitors: data.visitors?.value ?? null,
      pageviews: data.pageviews?.value ?? null,
      available: true,
    };
  } catch (err) {
    console.warn("Umami stats fetch failed:", err);
    return { visitors: null, pageviews: null, available: false };
  }
}

// --- Listmonk subscriber count ---------------------------------------------
async function getListmonkStats(): Promise<{
  subscribers: number | null;
  available: boolean;
}> {
  const listmonkUrl = process.env.LISTMONK_URL;
  const listmonkUser = process.env.LISTMONK_USER;
  const listmonkToken = process.env.LISTMONK_TOKEN;
  const listmonkListId = process.env.LISTMONK_LIST_ID;

  if (!listmonkUrl || !listmonkUser || !listmonkToken || !listmonkListId) {
    return { subscribers: null, available: false };
  }

  try {
    const base = listmonkUrl.replace(/\/+$/, "");
    // Listmonk API: GET /api/subscribers?list_id=X&count=true
    // Returns { total: number, ... }
    const url = `${base}/api/subscribers?list_id=${listmonkListId}&count=true`;

    const auth = Buffer.from(`${listmonkUser}:${listmonkToken}`).toString("base64");

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      console.warn(`Listmonk subscribers API error: ${res.status}`);
      return { subscribers: null, available: false };
    }

    const data = (await res.json()) as { total?: number };
    return {
      subscribers: typeof data.total === "number" ? data.total : null,
      available: true,
    };
  } catch (err) {
    console.warn("Listmonk subscribers fetch failed:", err);
    return { subscribers: null, available: false };
  }
}

// --- Service health indicators (placeholder names only) --------------------
function getServiceStatus() {
  // These are display names only — no internal IPs, hostnames, or credentials
  return [
    {
      name: "Web (Next.js)",
      status: "operational" as const,
      description: "Blog frontend & API",
    },
    {
      name: "Analytics (Umami)",
      status: "operational" as const,
      description: "Privacy-friendly visitor stats",
    },
    {
      name: "Newsletter (Listmonk)",
      status: "operational" as const,
      description: "Email campaigns & subscribers",
    },
    {
      name: "Database (PostgreSQL)",
      status: "operational" as const,
      description: "Post views & auth storage",
    },
  ];
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Fetch all stats in parallel
  const [blog, umami, listmonk] = await Promise.all([
    Promise.resolve(getBlogStats()),
    getUmamiStats(),
    getListmonkStats(),
  ]);

  const services = getServiceStatus();

  const response = {
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startTime,
    blog: blog,
    umami: {
      visitors: umami.visitors,
      pageviews: umami.pageviews,
      available: umami.available,
      note: umami.available
        ? "Last 30 days"
        : "Umami public API not configured or unavailable",
    },
    listmonk: {
      subscribers: listmonk.subscribers,
      available: listmonk.available,
      note: listmonk.available
        ? "Active subscribers"
        : "Listmonk not configured or unavailable",
    },
    services,
  };

  return Response.json(response, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}