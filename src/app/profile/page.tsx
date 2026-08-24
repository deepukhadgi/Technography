import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getUserBookmarks, type BookmarkWithPost } from "@/lib/bookmarks";
import { formatDate } from "@/lib/posts";
import BookmarkButton from "@/components/BookmarkButton";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/profile");
  }

  // Fetch profile data from API
  const profileRes = await fetch(
    new URL("/api/auth/profile", process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
    {
      headers: {
        cookie: session.userId ? `tg_session=${"placeholder"}` : "",
      },
      cache: "no-store",
    }
  );

  let profile = {
    email: session.email,
    firstName: "",
    lastName: "",
    createdAt: new Date(),
    bookmarkCount: 0,
  };

  if (profileRes.ok) {
    try {
      profile = await profileRes.json();
    } catch {
      // Use fallback values
    }
  }

  // Fetch bookmarks
  let bookmarks: BookmarkWithPost[] = [];
  try {
    bookmarks = await getUserBookmarks();
  } catch {
    bookmarks = [];
  }

  const recentBookmarks = bookmarks.slice(0, 5);
  const totalReadingTime = bookmarks.reduce((acc, b) => acc + (b.title ? 3 : 0), 0); // rough estimate

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> cat ~/profile.md
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Profile <span className="text-accent">/</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        Your account details and reading activity.
      </p>

      {/* User Info Card */}
      <div className="mt-10 rounded border border-line bg-panel p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 font-mono text-accent">
            {profile.firstName ? profile.firstName[0] : "U"}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-mono text-lg font-bold text-fg">
              {profile.firstName || "User"} {profile.lastName}
            </h2>
            <p className="font-mono text-sm text-dim">{profile.email}</p>
            <div className="mt-2 flex items-center gap-2 font-mono text-xs text-dim">
              <span>Member since</span>
              <span>{formatDate(profile.createdAt?.toISOString() || new Date().toISOString())}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded border border-line bg-panel p-4 text-center">
          <div className="font-mono text-2xl font-bold text-accent">{profile.bookmarkCount}</div>
          <div className="mt-1 font-mono text-xs text-dim">Bookmarks</div>
        </div>
        <div className="rounded border border-line bg-panel p-4 text-center">
          <div className="font-mono text-2xl font-bold text-cyan">{totalReadingTime}</div>
          <div className="mt-1 font-mono text-xs text-dim">Min Read</div>
        </div>
        <div className="col-span-2 rounded border border-line bg-panel p-4 text-center sm:col-span-1">
          <div className="font-mono text-2xl font-bold text-fg">{bookmarks.length}</div>
          <div className="mt-1 font-mono text-xs text-dim">Reading List</div>
        </div>
      </div>

      {/* Recent Bookmarks */}
      {recentBookmarks.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-4 font-mono text-sm font-bold text-dim">
            <span className="text-accent">→</span> Recent bookmarks
          </h3>
          <div className="space-y-3">
            {recentBookmarks.map((b) => (
              <div
                key={b.slug}
                className="group flex items-start gap-4 rounded border border-line bg-panel p-4 transition-colors hover:border-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/blog/${b.slug}`}
                    className="block font-mono text-sm font-bold text-fg transition-colors group-hover:text-accent"
                  >
                    {b.title}
                  </Link>
                  <div className="mt-1 font-mono text-xs text-dim">
                    <time>{formatDate(b.date)}</time>
                    <span aria-hidden="true" className="mx-2">·</span>
                    <span>saved {formatDate(b.created_at.toISOString())}</span>
                  </div>
                </div>
                <div className="shrink-0">
                  <BookmarkButton slug={b.slug} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/bookmarks"
          className="rounded border border-line bg-panel px-4 py-2 font-mono text-sm text-dim transition-colors hover:border-accent/50 hover:text-accent"
        >
          View all bookmarks →
        </Link>
        <Link
          href="/settings"
          className="rounded border border-line bg-panel px-4 py-2 font-mono text-sm text-dim transition-colors hover:border-accent/50 hover:text-accent"
        >
          Account settings →
        </Link>
      </div>
    </div>
  );
}
