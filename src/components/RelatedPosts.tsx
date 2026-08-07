import Link from "next/link";
import { formatDate, type PostMeta } from "@/lib/posts";

/** Max excerpt length shown on related-post cards. */
const EXCERPT_MAX = 80;

function truncateExcerpt(excerpt: string): string {
  if (excerpt.length <= EXCERPT_MAX) return excerpt;
  return `${excerpt.slice(0, EXCERPT_MAX).trimEnd()}…`;
}

/**
 * "Related Posts" card grid shown at the bottom of a post page. Pure
 * server component — renders static data only, no client interactivity.
 * Renders nothing when there are no related posts.
 */
export default function RelatedPosts({ posts }: { posts: PostMeta[] }) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="related-posts-heading" className="mt-12">
      <h2
        id="related-posts-heading"
        className="font-mono text-xl font-bold text-fg"
      >
        Related Posts
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="group block rounded border border-line bg-panel p-4 transition-colors hover:border-accent/50"
          >
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-dim">
              <time>{formatDate(p.date)}</time>
            </div>
            <h3 className="mt-2 font-mono text-sm font-bold group-hover:text-accent">
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
            </h3>
            <p className="mt-2 text-xs text-dim">{truncateExcerpt(p.excerpt)}</p>
            {p.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded border border-line px-2 py-0.5 text-[10px] text-dim/80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
