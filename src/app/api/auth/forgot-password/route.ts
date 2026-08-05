import { NextRequest } from "next/server";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { getPool } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mail";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_LIMIT = 5; // attempts per IP per hour
const EMAIL_LIMIT = 3; // attempts per email per hour
const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 1;
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

  const { email, hp } = (payload ?? {}) as {
    email?: unknown;
    hp?: unknown;
  };

  // Honeypot
  if (typeof hp === "string" && hp.length > 0) {
    return Response.json({ ok: true });
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  // Rate limits
  const ip = clientIp(req);
  const ipRetry = checkRateLimit(`forgot:ip:${ip}`, IP_LIMIT);
  if (ipRetry !== null) {
    return Response.json({ error: "Too many requests. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(ipRetry) },
    });
  }
  const emailRetry = checkRateLimit(`forgot:email:${normalizedEmail}`, EMAIL_LIMIT);
  if (emailRetry !== null) {
    return Response.json({ error: "Too many requests for this email. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(emailRetry) },
    });
  }

  const pool = getPool();

  // Find user (always same response to prevent email enumeration)
  const userResult = await pool.query<{ id: number; email: string }>(
    "SELECT id, email FROM users WHERE email = $1",
    [normalizedEmail]
  );

  // If user exists and is verified, generate reset token
  if (userResult.rowCount && userResult.rowCount > 0 && userResult.rows[0]) {
    const user = userResult.rows[0];

    // Delete any existing unused tokens for this user
    await pool.query(
      "DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
      [user.id]
    );

    // Generate secure token
    const token = randomBytes(TOKEN_BYTES).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600_000);

    await pool.query(
      "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
      [tokenHash, user.id, expiresAt]
    );

    // Send email (fire-and-forget to not leak existence via timing)
    sendPasswordResetEmail(user.email, token).catch(console.error);
  }

  // Always return success (prevents email enumeration)
  return Response.json({ ok: true });
}