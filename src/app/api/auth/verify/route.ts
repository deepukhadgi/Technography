import { NextRequest } from "next/server";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  if (!token || token.length > 128) {
    return Response.redirect(`${appUrl}/signup/error`, 302);
  }

  const pool = getPool();
  const found = await pool.query<{ id: number }>(
    `SELECT id FROM users
     WHERE verification_token = $1 AND verification_token_expires > now()`,
    [token]
  );

  if (found.rowCount === 0) {
    return Response.redirect(`${appUrl}/signup/error`, 302);
  }

  await pool.query(
    `UPDATE users
     SET email_verified = true, verification_token = NULL, verification_token_expires = NULL
     WHERE id = $1`,
    [found.rows[0].id]
  );

  return Response.redirect(`${appUrl}/signup/verified`, 302);
}
