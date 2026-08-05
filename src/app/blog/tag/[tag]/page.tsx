import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getAllTags, formatDate } from "@/lib/posts";

type Props = { params: Promise<{ tag: string }> };

// Next.js percent-decodes dynamic segments before matching (see the route
// matcher's decodeURIComponent), so params.tag already arrives decoded — e.g.
// "foo bar" for /blog/tag/foo%20bar. The try/catch guards tags containing a
// literal "%": encodeURIComponent turns it into "%25" in links, and decoding
// an already-decoded "%" would throw URIError.
function decodeTag(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function generateStaticParams() {
  return getAllTags().map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  return { title: `Posts tagged "${decodeTag(tag)}"` };
}

export default async function TagPage({ params }: Props) {
  const { tag: rawTag } = await params;
  const tag = decodeTag(rawTag);

  const posts = getAllPosts().filter((p) => p.tags.includes(tag));

  if (posts.length === 0) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Link
        href="/blog"
        className="inline-block py-2 font-mono text-xs text-dim hover:text-accent"
      >
        ← all posts
      </Link>

      <p className="mt-4 font-mono text-sm text-dim">
        <span className="text-accent">$</span> ls ./posts --tag {tag}
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Posts tagged <span className="text-accent">&quot;{tag}&quot;</span>
      </h1>
      <p className="mt-4 font-mono text-xs text-dim">
        {posts.length} {posts.length === 1 ? "post" : "posts"}
      </p>

      <div className="mt-10 space-y-4">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="group block rounded border border-line bg-panel p-5 transition-colors hover:border-accent/50"
          >
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-dim">
              <time>{formatDate(p.date)}</time>
              {p.tags.map((t) => (
                <span
                  key={t}
                  className="rounded border border-line px-2 py-0.5 text-[10px] text-dim/80"
                >
                  {t}
                </span>
              ))}
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
      </div>
    </div>
  );
}
