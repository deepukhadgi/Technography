import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = (payload ?? {}) as {
    email?: unknown;
    password?: unknown;
  };

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const pw = typeof password === "string" ? password : "";

  if (!normalizedEmail || !pw) {
    return Response.json({ error: "Email and password required" }, { status: 400 });
  }

  // Rate limit: 10 login attempts per IP per 15 min
  const ip = clientIp(req);
  const retry = checkRateLimit(`login:ip:${ip}`, 10);
  if (retry !== null) {
    return Response.json({ error: "Too many login attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(retry) },
    });
  }

  const pool = getPool();

  const result = await pool.query<{ id: number; password_hash: string; email_verified: boolean; first_name: string }>(
    "SELECT id, password_hash, email_verified, first_name FROM users WHERE email = $1",
    [normalizedEmail]
  );

  // Constant-time-ish: always hash even on miss to prevent timing oracle
  const dummyHash = "$2a$10$0000000000000000000000000000000000000000000000000000000";
  const storedHash = result.rows[0]?.password_hash ?? dummyHash;
  const valid = await bcrypt.compare(pw, storedHash);

  if (!result.rows[0] || !valid) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!result.rows[0].email_verified) {
    return Response.json({ error: "Please verify your email first" }, { status: 403 });
  }

  await createSession(result.rows[0].id, normalizedEmail);

  return Response.json({ ok: true, email: normalizedEmail, firstName: result.rows[0].first_name });
}
