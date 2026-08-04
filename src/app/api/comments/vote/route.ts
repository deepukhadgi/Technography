import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import {
  VOTER_COOKIE,
  getOrCreateVoter,
  buildVoterCookieValue,
  voterCookieOptions,
} from "@/lib/voter";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { commentId, value } = (payload ?? {}) as {
    commentId?: unknown;
    value?: unknown;
  };

  const id = Number(commentId);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid commentId" }, { status: 400 });
  }
  if (value !== 1 && value !== -1) {
    return Response.json({ error: "value must be 1 or -1" }, { status: 400 });
  }

  const store = await cookies();
  const raw = store.get(VOTER_COOKIE)?.value;
  const { voterKey, isNew } = getOrCreateVoter(raw);
  if (isNew) {
    store.set(VOTER_COOKIE, buildVoterCookieValue(voterKey), voterCookieOptions());
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query("SELECT 1 FROM comments WHERE id = $1", [id]);
    if (exists.rowCount === 0) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }

    const prev = await client.query<{ value: number }>(
      "SELECT value FROM comment_votes WHERE comment_id = $1 AND voter_key = $2 FOR UPDATE",
      [id, voterKey]
    );

    if (prev.rowCount === 0) {
      await client.query(
        "INSERT INTO comment_votes (comment_id, voter_key, value) VALUES ($1, $2, $3)",
        [id, voterKey, value]
      );
    } else if (prev.rows[0].value === value) {
      // same vote again → toggle off
      await client.query(
        "DELETE FROM comment_votes WHERE comment_id = $1 AND voter_key = $2",
        [id, voterKey]
      );
    } else {
      // switch like <-> dislike
      await client.query(
        "UPDATE comment_votes SET value = $3 WHERE comment_id = $1 AND voter_key = $2",
        [id, voterKey, value]
      );
    }

    const counts = await client.query<{ likes: number; dislikes: number; my_vote: number | null }>(
      `SELECT COALESCE(COUNT(*) FILTER (WHERE value = 1), 0)::int  AS likes,
              COALESCE(COUNT(*) FILTER (WHERE value = -1), 0)::int AS dislikes,
              COALESCE(MAX(CASE WHEN voter_key = $2 THEN value END), 0)::int AS my_vote
       FROM comment_votes
       WHERE comment_id = $1`,
      [id, voterKey]
    );

    await client.query("COMMIT");

    const c = counts.rows[0];
    return Response.json({
      likes: c.likes,
      dislikes: c.dislikes,
      myVote: c.my_vote ?? 0,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("vote failed:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  } finally {
    client.release();
  }
}
