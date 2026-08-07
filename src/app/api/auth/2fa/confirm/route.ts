import { NextRequest } from "next/server";
import { getPool } from "@/lib/db";
import { createSession } from "@/lib/auth";
import {
  decryptTotpSecret,
  isValidTotpCode,
  verifyTempToken,
  verifyTotpCode,
} from "@/lib/totp";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Second step of login: swap { code, temporaryToken } for a real session.
// The temporaryToken comes from POST /api/auth/login when the account has
// 2FA enabled; it is HMAC-signed and expires after 5 minutes.

// TOTP codes are 6 digits — rate limit brute force hard:
// 10 per IP per hour, plus 10 per user per hour.
const CONFIRM_IP_LIMIT = 10;
const CONFIRM_USER_LIMIT = 10;

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { code, temporaryToken } = (payload ?? {}) as {
    code?: unknown;
    temporaryToken?: unknown;
  };

  if (typeof temporaryToken !== "string" || !temporaryToken) {
    return Response.json({ error: "Session expired — please log in again" }, { status: 401 });
  }
  if (!isValidTotpCode(code)) {
    return Response.json({ error: "Enter the 6-digit code from your authenticator app" }, { status: 400 });
  }

  const userId = verifyTempToken(temporaryToken);
  if (userId === null) {
    return Response.json({ error: "Session expired — please log in again" }, { status: 401 });
  }

  const ip = clientIp(req);
  const ipRetry = checkRateLimit(`2fa:confirm:ip:${ip}`, CONFIRM_IP_LIMIT);
  if (ipRetry !== null) {
    return Response.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(ipRetry) },
    });
  }
  const userRetry = checkRateLimit(`2fa:confirm:user:${userId}`, CONFIRM_USER_LIMIT);
  if (userRetry !== null) {
    return Response.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(userRetry) },
    });
  }

  const pool = getPool();
  const result = await pool.query<{
    id: number;
    email: string;
    first_name: string;
    email_verified: boolean;
    totp_secret: string | null;
  }>(
    "SELECT id, email, first_name, email_verified, totp_secret FROM users WHERE id = $1",
    [userId]
  );

  const user = result.rows[0];
  if (!user || !user.email_verified || !user.totp_secret) {
    return Response.json({ error: "Session expired — please log in again" }, { status: 401 });
  }

  let plain: string;
  try {
    plain = decryptTotpSecret(user.totp_secret);
  } catch (err) {
    console.error("2fa confirm: failed to decrypt stored secret:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  const valid = await verifyTotpCode(code, plain);
  if (!valid) {
    return Response.json({ error: "Invalid code — check your authenticator app" }, { status: 401 });
  }

  await createSession(user.id, user.email);

  return Response.json({ ok: true, email: user.email, firstName: user.first_name });
}
