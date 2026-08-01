import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug, formatDate } from "@/lib/posts";

type Props = { params: Promise<{ slug: string }> };

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

  return (
    <article className="mx-auto max-w-4xl px-4 py-16">
      <Link
        href="/blog"
        className="font-mono text-xs text-dim hover:text-accent"
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
          {post.title}
        </h1>
      </header>

      <div
        className="post-content prose prose-invert prose-sm mt-8 max-w-none text-dim prose-headings:text-fg prose-strong:text-fg"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </article>
  );
}
