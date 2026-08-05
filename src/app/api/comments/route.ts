import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import {
  VOTER_COOKIE,
  getOrCreateVoter,
  buildVoterCookieValue,
  voterCookieOptions,
} from "@/lib/voter";
import { sendReplyNotificationEmail } from "@/lib/mail";
import { getPostBySlug } from "@/lib/posts";

export const runtime = "nodejs";

/** Strip all HTML tags to prevent stored XSS. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

type CommentRow = {
  id: number;
  post_slug: string;
  author_name: string;
  body: string;
  parent_id: number | null;
  created_at: Date;
  likes: number;
  dislikes: number;
  my_vote: number | null;
};

function toComment(c: CommentRow) {
  return {
    id: c.id,
    postSlug: c.post_slug,
    authorName: c.author_name,
    body: c.body,
    parentId: c.parent_id,
    createdAt: c.created_at.toISOString(),
    likes: c.likes,
    dislikes: c.dislikes,
    myVote: c.my_vote ?? 0,
  };
}

async function getVoterKey(setIfMissing: boolean): Promise<{
  voterKey: string;
  cookieValue: string | null;
}> {
  const store = await cookies();
  const raw = store.get(VOTER_COOKIE)?.value;
  const { voterKey, isNew } = getOrCreateVoter(raw);
  let cookieValue: string | null = null;
  if (isNew && setIfMissing) {
    cookieValue = buildVoterCookieValue(voterKey);
    store.set(VOTER_COOKIE, cookieValue, voterCookieOptions());
  }
  return { voterKey, cookieValue };
}

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim();
  if (!slug || slug.length > 200) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const { voterKey } = await getVoterKey(false);

  const pool = getPool();
  const result = await pool.query<CommentRow>(
    `SELECT c.id,
            c.post_slug,
            c.author_name,
            c.body,
            c.parent_id,
            c.created_at,
            COALESCE(s.likes, 0)::int  AS likes,
            COALESCE(s.dislikes, 0)::int AS dislikes,
            my.value                     AS my_vote
     FROM comments c
     LEFT JOIN (
       SELECT comment_id,
              COUNT(*) FILTER (WHERE value = 1)  AS likes,
              COUNT(*) FILTER (WHERE value = -1) AS dislikes
       FROM comment_votes
       GROUP BY comment_id
     ) s ON s.comment_id = c.id
     LEFT JOIN comment_votes my
            ON my.comment_id = c.id AND my.voter_key = $2
     WHERE c.post_slug = $1 AND c.is_approved = true
     ORDER BY c.created_at DESC, c.id DESC`,
    [slug, voterKey]
  );

  return Response.json({ comments: result.rows.map(toComment) });
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { postSlug, authorName, body, hp, parentId, notifyEmail } = (payload ?? {}) as {
    postSlug?: unknown;
    authorName?: unknown;
    body?: unknown;
    hp?: unknown;
    parentId?: unknown;
    notifyEmail?: unknown;
  };

  // Honeypot: bots that fill the hidden field get a fake success, nothing stored.
  if (typeof hp === "string" && hp.length > 0) {
    return Response.json({ ok: true });
  }

  const slug = typeof postSlug === "string" ? postSlug.trim() : "";
  const name = stripHtml(typeof authorName === "string" ? authorName.trim() : "");
  const text = stripHtml(typeof body === "string" ? body.trim() : "");
  const parentIdNum = typeof parentId === "number" && Number.isInteger(parentId) ? parentId : null;
  const notifyEmailStr =
    typeof notifyEmail === "string"
      ? notifyEmail.trim().toLowerCase().slice(0, 200)
      : "";

  if (!slug || slug.length > 200) {
    return Response.json({ error: "postSlug must be 1-200 characters" }, { status: 400 });
  }
  if (!name || name.length > 80) {
    return Response.json({ error: "authorName must be 1-80 characters" }, { status: 400 });
  }
  if (!text || text.length > 2000) {
    return Response.json({ error: "body must be 1-2000 characters" }, { status: 400 });
  }

  const pool = getPool();

  // If replying, the parent must exist and belong to the same post.
  let parentEmail: string | null = null;
  if (parentIdNum !== null) {
    const parent = await pool.query<{ notify_email: string | null; post_slug: string }>(
      "SELECT notify_email, post_slug FROM comments WHERE id = $1",
      [parentIdNum]
    );
    if (parent.rowCount === 0) {
      return Response.json({ error: "Parent comment not found" }, { status: 400 });
    }
    if (parent.rows[0].post_slug !== slug) {
      return Response.json({ error: "Parent comment is on a different post" }, { status: 400 });
    }
    parentEmail = parent.rows[0].notify_email;
  }

  const result = await pool.query<CommentRow>(
    `INSERT INTO comments (post_slug, author_name, body, parent_id, notify_email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, post_slug, author_name, body, parent_id, created_at,
               0::int AS likes, 0::int AS dislikes, NULL::int AS my_vote`,
    [slug, name, text, parentIdNum, notifyEmailStr || null]
  );

  // Fire-and-forget reply notification email (never block the response).
  if (parentIdNum !== null && parentEmail) {
    try {
      let postTitle = slug;
      try {
        const post = await getPostBySlug(slug);
        postTitle = post.title;
      } catch {
        /* post metadata unavailable — fall back to slug */
      }
      void sendReplyNotificationEmail({
        to: parentEmail,
        commenterName: name,
        replyBody: text,
        postTitle,
        postSlug: slug,
        commentUrl: `${process.env.APP_URL ?? "https://deepukhadgi.com.np"}/blog/${slug}#comment-${result.rows[0].id}`,
      }).catch(() => {
        /* email failure must not break commenting */
      });
    } catch {
      /* ignore */
    }
  }

  return Response.json({ ok: true, comment: toComment(result.rows[0]) }, { status: 201 });
}
