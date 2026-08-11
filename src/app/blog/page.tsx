import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, formatDate } from "@/lib/posts";
import SearchBox from "@/components/SearchBox";
import ViewCounter from "@/components/ViewCounter";

export const metadata: Metadata = { title: "Blog" };

type ViewMap = Record<string, number>;

async function fetchViewCounts(slugs: string[]): Promise<ViewMap> {
  const results = await Promise.allSettled(
    slugs.map(async (slug) => {
      const res = await fetch(`/api/views?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { views?: number };
      return { slug, views: data.views ?? 0 };
    })
  );
  const map: ViewMap = {};
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      map[r.value.slug] = r.value.views;
    }
  }
  return map;
}

export default async function BlogPage() {
  const posts = getAllPosts();
  const viewCounts = await fetchViewCounts(posts.map((p) => p.slug));

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> ls ./posts
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Blog <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        Notes on technology, infrastructure, and whatever I&apos;m working on.
        New posts as I learn and build.
      </p>

      <div className="mt-8">
        <SearchBox />
      </div>

      <div className="mt-10 space-y-4">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="group block rounded border border-line bg-panel p-5 transition-colors hover:border-accent/50"
          >
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-dim">
              <time>{formatDate(p.date)}</time>
              <span aria-hidden="true">·</span>
              <span>⏱ {p.readingTime} min read</span>
              {p.tags.map((t) => (
                <Link
                  key={t}
                  href={`/blog/tag/${encodeURIComponent(t)}`}
                  className="rounded border border-line px-2 py-0.5 text-[10px] text-dim/80 transition-colors hover:border-accent hover:text-accent"
                >
                  {t}
                </Link>
              ))}
              {viewCounts[p.slug] !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <ViewCounter
                    slug={p.slug}
                    initialViewCount={viewCounts[p.slug]}
                  />
                </>
              )}
            </div>
            <h2 className="mt-2 font-mono text-base font-bold group-hover:text-accent">
              {p.premium && (
                <span
                  className="mr-1"
                  title="Subscriber-only"
                  aria-label="subscriber-only"
                >
                  🔒
                </span>
              )}
              {p.title}
            </h2>
            <p className="mt-2 text-sm text-dim">{p.excerpt}</p>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-sm text-dim">No posts yet — coming soon.</p>
        )}
      </div>
    </div>
  );
}
