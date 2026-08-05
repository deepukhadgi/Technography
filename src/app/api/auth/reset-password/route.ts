import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { getPool } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const IP_LIMIT = 10; // attempts per IP per 15 min
const SECRET = process.env.SESSION_SECRET ?? "dev-fallback";

function hashToken(token: string): string {
  return createHmac("sha256", SECRET).update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { token, password, confirmPassword } = (payload ?? {}) as {
    token?: unknown;
    password?: unknown;
    confirmPassword?: unknown;
  };

  const t = typeof token === "string" ? token.trim() : "";
  const pw = typeof password === "string" ? password : "";
  const cpw = typeof confirmPassword === "string" ? confirmPassword : "";

  if (!t) {
    return Response.json({ error: "Invalid or missing reset token" }, { status: 400 });
  }
  if (!pw || pw.length < 8 || pw.length > 200) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (pw !== cpw) {
    return Response.json({ error: "Passwords do not match" }, { status: 400 });
  }

  // Rate limit
  const ip = clientIp(req);
  const retry = checkRateLimit(`reset:ip:${ip}`, IP_LIMIT);
  if (retry !== null) {
    return Response.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(retry) },
    });
  }

  const pool = getPool();
  const tokenHash = hashToken(t);

  // Find valid, unused token
  const tokenResult = await pool.query<{ user_id: number; expires_at: Date }>(
    `SELECT user_id, expires_at FROM password_reset_tokens 
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );

  if (tokenResult.rowCount === 0) {
    return Response.json({ error: "Invalid or expired reset token" }, { status: 400 });
  }

  const resetToken = tokenResult.rows[0];
  const userId = resetToken.user_id;

  // Hash new password
  const passwordHash = await bcrypt.hash(pw, 10);

  // Update user password and mark token used in transaction
  await pool.query("BEGIN");
  try {
    await pool.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, userId]
    );
    await pool.query(
      "UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1",
      [tokenHash]
    );
    // Invalidate all other sessions for this user
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await pool.query("COMMIT");
  } catch {
    await pool.query("ROLLBACK");
    throw new Error("Transaction failed");
  }

  return Response.json({ ok: true, message: "Password reset successful" });
}