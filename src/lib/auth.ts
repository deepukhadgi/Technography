import { cookies } from "next/headers";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { getPool } from "@/lib/db";

const COOKIE_NAME = "tg_session";
const SESSION_DAYS = 30;
const SECRET = process.env.SESSION_SECRET ?? "dev-fallback";

export interface SessionPayload {
  userId: number;
  email: string;
}

function sign(payload: string): string {
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function unsign(signed: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

export async function createSession(userId: number, email: string): Promise<string> {
  const pool = getPool();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);

  await pool.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sign(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });

  return token;
}

const IDLE_TIMEOUT_MINUTES = 30;

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(COOKIE_NAME)?.value;
  if (!signed) return null;

  const token = unsign(signed);
  if (!token) return null;

  const pool = getPool();
  const result = await pool.query<{ user_id: number; last_activity_at: string }>(
    "SELECT user_id, last_activity_at FROM sessions WHERE token = $1 AND expires_at > now()",
    [token]
  );

  if (result.rowCount === 0) return null;

  // Check if session has been idle for more than 30 minutes
  const lastActivity = new Date(result.rows[0].last_activity_at);
  const now = new Date();
  const idleMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

  if (idleMinutes > IDLE_TIMEOUT_MINUTES) {
    // Session has expired due to inactivity - delete it
    await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    return null;
  }

  const user = await pool.query<{ email: string }>(
    "SELECT email FROM users WHERE id = $1",
    [result.rows[0].user_id]
  );

  if (user.rowCount === 0) return null;

  // Update last_activity_at on every authenticated request
  await pool.query(
    "UPDATE sessions SET last_activity_at = now() WHERE token = $1",
    [token]
  );

  return { userId: result.rows[0].user_id, email: user.rows[0].email };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const signed = cookieStore.get(COOKIE_NAME)?.value;
  if (signed) {
    const token = unsign(signed);
    if (token) {
      const pool = getPool();
      await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
    }
  }
  cookieStore.delete(COOKIE_NAME);
}
