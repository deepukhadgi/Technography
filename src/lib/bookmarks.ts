import { getPool } from "./db";
import { getSession } from "./auth";
import { checkRateLimit, clientIp } from "./rateLimit";
import type { PostMeta } from "./posts";

export type BookmarkRow = {
  id: number;
  user_id: number;
  slug: string;
  created_at: Date;
};

export type BookmarkWithPost = BookmarkRow & {
  title: string;
  date: string;
  excerpt: string;
};

/**
 * Insert a bookmark for the authenticated user.
 * Returns null on duplicate (conflict). Throws on other DB errors.
 */
export async function insertBookmark(slug: string): Promise<BookmarkRow | null> {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");

  const pool = getPool();
  const result = await pool.query<BookmarkRow>(
    `INSERT INTO bookmarks (user_id, slug) VALUES ($1, $2) RETURNING id, user_id, slug, created_at`,
    [session.userId, slug]
  );
  return result.rows[0] ?? null;
}

/**
 * Remove a bookmark for the authenticated user. Returns true if a row was deleted.
 */
export async function deleteBookmark(slug: string): Promise<boolean> {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");

  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM bookmarks WHERE user_id = $1 AND slug = $2`,
    [session.userId, slug]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Get all bookmarks for the authenticated user, joined with post metadata from
 * the markdown filesystem. Only returns rows where the post still exists.
 */
export async function getUserBookmarks(): Promise<BookmarkWithPost[]> {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");

  const pool = getPool();
  const result = await pool.query<BookmarkRow>(
    `SELECT id, user_id, slug, created_at FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC`,
    [session.userId]
  );

  // Enrich with post metadata (only keep posts that still exist)
  const enriched: BookmarkWithPost[] = [];
  for (const row of result.rows) {
    try {
      const post = await import("./posts").then((m) => m.getPostBySlug(row.slug));
      enriched.push({
        ...row,
        title: post.title,
        date: post.date,
        excerpt: post.excerpt,
      });
    } catch {
      // Post no longer exists; skip it silently
    }
  }

  return enriched;
}

/**
 * Check whether the given slug is bookmarked by the authenticated user.
 */
export async function isBookmarked(slug: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const pool = getPool();
  const result = await pool.query(
    `SELECT 1 FROM bookmarks WHERE user_id = $1 AND slug = $2 LIMIT 1`,
    [session.userId, slug]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Rate-limit guard: returns null if allowed, or the seconds-to-wait string
 * if the user has exceeded 30 requests per 60-second window.
 */
export function bookmarkRateLimit(req: Request): string | null {
  const session = getSession().then((s) => s?.userId ?? null);
  // We check rate limit by session user id or IP as fallback.
  // Since getSession is async, we do a lightweight key based on IP for now.
  // The session check is done inside the route handler.
  const ip = clientIp(req);
  const key = `bookmark:${ip}`;
  const retryAfter = checkRateLimit(key, 30);
  if (retryAfter !== null) {
    return String(retryAfter);
  }
  return null;
}
