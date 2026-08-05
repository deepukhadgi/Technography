import { NextRequest } from "next/server";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const MEILI_HOST = process.env.MEILI_HOST ?? (() => { throw new Error("MEILI_HOST must be set in .env.local — never use the default fallback"); })();
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY ?? (() => { throw new Error("MEILI_MASTER_KEY must be set in .env.local — never use the default fallback"); })();

type Hit = {
  slug: string;
  title?: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    return Response.json({ results: [] });
  }
  if (q.length > 100) {
    return Response.json({ error: "Query too long" }, { status: 400 });
  }
  if (!MEILI_MASTER_KEY) {
    return Response.json({ error: "Search not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${MEILI_HOST}/indexes/posts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MEILI_MASTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q,
        limit: 10,
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
      date: h.date,
      tags: h.tags ?? [],
    }));

    return Response.json({ results });
  } catch (err) {
    console.error("Search proxy error", err);
    return Response.json({ error: "Search unavailable" }, { status: 502 });
  }
}