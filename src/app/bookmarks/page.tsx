import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getUserBookmarks, type BookmarkWithPost } from "@/lib/bookmarks";
import { formatDate } from "@/lib/posts";
import BookmarkButton from "@/components/BookmarkButton";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/bookmarks");
  }

  let bookmarks: BookmarkWithPost[] = [];
  try {
    bookmarks = await getUserBookmarks();
  } catch {
    bookmarks = [];
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> cat ~/reading-list.md
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Bookmarks <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        Posts you&apos;ve saved to read later. Manage your reading list below.
      </p>

      {bookmarks.length === 0 ? (
        <div className="mt-10 rounded border border-line bg-panel p-8 text-center">
          <p className="font-mono text-sm text-dim">
            <span className="text-accent">$</span> echo &apos;no bookmarks yet&apos;
          </p>
          <p className="mt-3 text-sm text-dim">
            <Link href="/blog" className="text-accent hover:underline">
              Browse posts
            </Link>{" "}
            and click the bookmark icon to save them here.
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {bookmarks.map((b) => (
            <div
              key={b.slug}
              className="group flex items-start gap-4 rounded border border-line bg-panel p-5 transition-colors hover:border-accent/50"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/blog/${b.slug}`}
                  className="block font-mono text-base font-bold text-fg transition-colors group-hover:text-accent"
                >
                  {b.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-dim">
                  <time>{formatDate(b.date)}</time>
                  <span aria-hidden="true">·</span>
                  <span>saved {formatDate(b.created_at.toISOString())}</span>
                </div>
                {b.excerpt && (
                  <p className="mt-2 text-sm text-dim">{b.excerpt}</p>
                )}
              </div>
              <div className="shrink-0">
                <BookmarkButton slug={b.slug} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
