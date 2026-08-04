import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, formatDate } from "@/lib/posts";
import { isSubscriber } from "@/lib/subscriber";
import CommentsSection from "@/components/CommentsSection";

type Props = { params: Promise<{ slug: string }> };

// Force-dynamic: premium posts must not be statically cached (gate depends
// on request-time cookies). Public posts are fast to re-render from local
// markdown (no DB hit unless they opt into premium later). This ensures
// every request runs the gate check for premium posts while keeping public
// posts fully functional. (An `export const dynamic = "force-dynamic"` on
// this route skips build-time prerendering entirely, avoiding the
// DYNAMIC_SERVER_USAGE error that Next.js 16 throws when cookies() is used
// during on-demand static generation of non-listed params.)
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPostBySlug(slug);
    return { title: post.title };
  } catch {
    return { title: "Post not found" };
  }
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  let post;
  try {
    post = await getPostBySlug(slug);
  } catch {
    notFound();
  }

  // Premium posts: gate on the subscriber check (any verified logged-in user
  // for now — see src/lib/subscriber.ts). Public posts render fully.
  const subscriber = post.premium ? await isSubscriber() : true;

  return (
    <article className="mx-auto max-w-4xl px-4 py-16">
      <Link
        href="/blog"
        className="inline-block py-2 font-mono text-xs text-dim hover:text-accent"
      >
        ← back to blog
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-dim">
          <time>{formatDate(post.date)}</time>
          {post.tags.map((t) => (
            <span
              key={t}
              className="rounded border border-line px-2 py-0.5 text-[10px]"
            >
              {t}
            </span>
          ))}
        </div>
        <h1 className="mt-3 font-mono text-3xl font-bold leading-tight sm:text-4xl">
          {post.premium && (
            <span aria-label="subscriber-only" title="Subscriber-only">
              🔒{" "}
            </span>
          )}
          {post.title}
        </h1>
      </header>

      {subscriber ? (
        <>
          <div
            className="post-content prose prose-invert prose-base mt-8 max-w-none text-dim prose-headings:text-fg prose-strong:text-fg"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
          {/* client-side comments — hidden from non-subscribers on premium posts */}
          <CommentsSection slug={slug} />
        </>
      ) : (
        <div className="mt-8 rounded border border-line bg-panel p-6">
          <p className="font-mono text-xs text-dim">
            <span className="text-accent">$</span> chmod +r post
          </p>
          <h2 className="mt-3 font-mono text-xl font-bold">
            🔒 Subscriber-only content
          </h2>
          <p className="mt-3 text-sm text-dim">{post.excerpt}</p>
          <p className="mt-4 text-sm text-dim">
            The full post is for subscribers. Log in with a verified account to
            read it.
          </p>
          <Link
            href={`/login?next=/blog/${slug}`}
            className="mt-6 inline-block rounded border border-accent/60 bg-accent/10 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent hover:text-bg"
          >
            log in to read →
          </Link>
        </div>
      )}
    </article>
  );
}
