import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();

  const userRow = await pool.query(
    `SELECT id, email, first_name, last_name, created_at
     FROM users WHERE id = $1`,
    [session.userId]
  );
  if (userRow.rowCount === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const user = userRow.rows[0];

  const bookmarksCount = await pool.query(
    `SELECT COUNT(*) AS cnt FROM bookmarks WHERE user_id = $1`,
    [session.userId]
  );
  const bookmarkCount = parseInt(bookmarksCount.rows[0].cnt, 10);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    createdAt: user.created_at,
    bookmarkCount,
  });
}
