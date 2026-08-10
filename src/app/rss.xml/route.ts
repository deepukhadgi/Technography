import { getAllPosts, getPostBySlug } from "@/lib/posts";
import { isSubscriber } from "@/lib/subscriber";

const BASE = "https://deepukhadgi.com.np";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const dynamic = "force-dynamic";

export async function GET() {
  // Subscribers get the full post HTML in <content:encoded>; everyone else
  // gets excerpts only. The cookie check makes this request dynamic.
  const subscriber = await isSubscriber();
  const posts = getAllPosts().slice(0, 20);

  // Full content only for subscribers — render markdown lazily.
  const contentBySlug = new Map<string, string>();
  if (subscriber) {
    for (const m of posts) {
      try {
        contentBySlug.set(m.slug, (await getPostBySlug(m.slug)).contentHtml);
      } catch {
        /* skip unparseable post content — excerpt still included */
      }
    }
  }

  const items = posts
    .map((p) => {
      const pubDate = new Date(p.date).toUTCString();
      const content = contentBySlug.get(p.slug) ?? null;
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${BASE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${BASE}/blog/${p.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.excerpt)}</description>
      ${p.tags.map((t) => `      <category>${escapeXml(t)}</category>`).join("\n")}
      ${content ? `      <content:encoded><![CDATA[${content}]]></content:encoded>` : ""}
    </item>`;
    })
    .join("\n");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Deepu Khadgi — Technography</title>
    <link>${BASE}</link>
    <description>Networks, containers, VMs, and infrastructure that just works. Personal blog about tech and the stuff I build.</description>
    <language>en-us</language>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Subscriber feeds contain full content — never let a shared cache
      // serve them to anonymous readers.
      "Cache-Control": subscriber
        ? "private, no-store"
        : "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
