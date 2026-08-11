import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  insertBookmark,
  deleteBookmark,
  getUserBookmarks,
  isBookmarked,
  bookmarkRateLimit,
} from "@/lib/bookmarks";
import { getAllPosts, type PostMeta } from "@/lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Build a lightweight bookmark list item for the GET endpoint. */
function toBookmarkItem(post: PostMeta) {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    excerpt: post.excerpt,
  };
}

// POST /api/bookmarks — add a bookmark
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitHeader = bookmarkRateLimit(req);
  if (rateLimitHeader) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": rateLimitHeader } }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug } = (payload ?? {}) as { slug?: unknown };
  const slugStr = typeof slug === "string" ? slug.trim() : "";

  if (!slugStr || slugStr.length > 200) {
    return NextResponse.json(
      { error: "slug is required (1-200 characters)" },
      { status: 400 }
    );
  }

  // Verify the post exists before bookmarking
  const allPosts = getAllPosts();
  const exists = allPosts.some((p) => p.slug === slugStr);
  if (!exists) {
    return NextResponse.json(
      { error: "Post not found" },
      { status: 404 }
    );
  }

  try {
    const bookmark = await insertBookmark(slugStr);
    if (!bookmark) {
      // Duplicate — UNIQUE constraint violation
      return NextResponse.json(
        { error: "Already bookmarked" },
        { status: 409 }
      );
    }
    return NextResponse.json(bookmark, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("duplicate key")) {
      return NextResponse.json(
        { error: "Already bookmarked" },
        { status: 409 }
      );
    }
    throw e;
  }
}

// DELETE /api/bookmarks?slug=xxx — remove a bookmark
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  if (!slug) {
    return NextResponse.json(
      { error: "slug query param is required" },
      { status: 400 }
    );
  }

  const ok = await deleteBookmark(slug);
  return NextResponse.json({ ok });
}

// GET /api/bookmarks — list current user's bookmarks with post metadata
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If ?slug is provided, return just the bookmarked status for that slug
  const slugParam = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  if (slugParam) {
    const bookmarked = await isBookmarked(slugParam);
    return NextResponse.json({ bookmarked });
  }

  const bookmarks = await getUserBookmarks();
  return NextResponse.json({ bookmarks });
}
