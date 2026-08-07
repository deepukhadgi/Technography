import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  encryptTotpSecret,
  isValidBase32Secret,
  isValidTotpCode,
  verifyTotpCode,
} from "@/lib/totp";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// TOTP codes are 6 digits — rate limit brute force hard: 10 per IP per hour.
const VERIFY_IP_LIMIT = 10;

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

  const { token, secret } = (payload ?? {}) as {
    token?: unknown;
    secret?: unknown;
  };

  if (!isValidTotpCode(token)) {
    return Response.json({ error: "Enter the 6-digit code from your authenticator app" }, { status: 400 });
  }
  if (!isValidBase32Secret(secret)) {
    return Response.json({ error: "Invalid setup secret" }, { status: 400 });
  }

  const ip = clientIp(req);
  const retry = checkRateLimit(`2fa:verify:ip:${ip}`, VERIFY_IP_LIMIT);
  if (retry !== null) {
    return Response.json({ error: "Too many attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(retry) },
    });
  }

  const valid = await verifyTotpCode(token, secret);
  if (!valid) {
    return Response.json({ error: "Invalid code — check your authenticator app" }, { status: 400 });
  }

  const pool = getPool();
  await pool.query("UPDATE users SET totp_secret = $1 WHERE id = $2", [
    encryptTotpSecret(secret),
    session.userId,
  ]);

  return Response.json({ enabled: true });
}
