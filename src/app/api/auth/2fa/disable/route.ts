import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  decryptTotpSecret,
  isValidTotpCode,
  verifyTotpCode,
} from "@/lib/totp";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// TOTP codes are 6 digits — rate limit brute force hard: 10 per IP per hour.
const DISABLE_IP_LIMIT = 10;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { code } = (payload ?? {}) as { code?: unknown };

  if (!isValidTotpCode(code)) {
    return Response.json({ error: "Enter the 6-digit code from your authenticator app" }, { status: 400 });
  }

  const ip = clientIp(req);
  const retry = checkRateLimit(`2fa:disable:ip:${ip}`, DISABLE_IP_LIMIT);
  if (retry !== null) {
    return Response.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(retry) },
    });
  }

  const pool = getPool();
  const result = await pool.query<{ totp_secret: string | null }>(
    "SELECT totp_secret FROM users WHERE id = $1",
    [session.userId]
  );

  const stored = result.rows[0]?.totp_secret ?? null;
  if (!stored) {
    return Response.json({ error: "Two-factor authentication is not enabled" }, { status: 400 });
  }

  let plain: string;
  try {
    plain = decryptTotpSecret(stored);
  } catch (err) {
    console.error("2fa disable: failed to decrypt stored secret:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  const valid = await verifyTotpCode(code, plain);
  if (!valid) {
    return Response.json({ error: "Invalid code — check your authenticator app" }, { status: 400 });
  }

  await pool.query("UPDATE users SET totp_secret = NULL WHERE id = $1", [
    session.userId,
  ]);

  return Response.json({ enabled: false });
}
