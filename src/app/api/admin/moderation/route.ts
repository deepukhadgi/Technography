import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PendingComment = {
  id: number;
  post_slug: string;
  author_name: string;
  body: string;
  parent_id: number | null;
  notify_email: string | null;
  created_at: Date;
  is_approved: boolean;
};

/** Owner-only guard. Returns a 403 Response when the caller is not the owner. */
async function requireOwner(): Promise<Response | null> {
  const session = await getSession();
  if (!session || session.email !== process.env.OWNER_EMAIL) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** GET /api/admin/moderation — list comments awaiting approval. */
export async function GET() {
  const denied = await requireOwner();
  if (denied) return denied;

  const pool = getPool();
  const result = await pool.query<PendingComment>(
    `SELECT id, post_slug, author_name, body, parent_id, notify_email, created_at, is_approved
     FROM comments
     WHERE is_approved = false
     ORDER BY created_at DESC, id DESC`
  );

  return Response.json({ comments: result.rows });
}

/** PATCH /api/admin/moderation — body: { id, action: "approve" | "hide" }. */
export async function PATCH(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, action } = (payload ?? {}) as { id?: unknown; action?: unknown };
  const commentId = typeof id === "number" && Number.isInteger(id) ? id : NaN;
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  if (action !== "approve" && action !== "hide") {
    return Response.json({ error: "action must be 'approve' or 'hide'" }, { status: 400 });
  }

  const pool = getPool();

  if (action === "approve") {
    const result = await pool.query(
      "UPDATE comments SET is_approved = true WHERE id = $1 RETURNING id",
      [commentId]
    );
    if (result.rowCount === 0) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  }

  // hide: no-op when already hidden (is_approved = false)
  await pool.query("UPDATE comments SET is_approved = false WHERE id = $1", [commentId]);
  return Response.json({ ok: true });
}

/** DELETE /api/admin/moderation?id=123 — permanently delete a comment. */
export async function DELETE(req: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const idRaw = req.nextUrl.searchParams.get("id");
  const commentId = idRaw !== null ? Number(idRaw) : NaN;
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  // comment_votes and replies cascade on delete.
  const pool = getPool();
  await pool.query("DELETE FROM comments WHERE id = $1", [commentId]);
  return Response.json({ ok: true });
}
