import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mail";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { telegramNotify } from "@/lib/telegramNotify";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_LIMIT = 5; // attempts per IP per hour
const EMAIL_LIMIT = 3; // attempts per email per hour

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password, confirmPassword, firstName, lastName, hp } = (payload ?? {}) as {
    email?: unknown;
    password?: unknown;
    confirmPassword?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    hp?: unknown;
  };

  // Honeypot: bots get a fake success, nothing stored.
  if (typeof hp === "string" && hp.length > 0) {
    return Response.json({ ok: true });
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const pw = typeof password === "string" ? password : "";
  const cpw = typeof confirmPassword === "string" ? confirmPassword : "";
  const fn = typeof firstName === "string" ? firstName.trim() : "";
  const ln = typeof lastName === "string" ? lastName.trim() : "";

  if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 254) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!fn || fn.length > 100) {
    return Response.json({ error: "First name is required (max 100 chars)" }, { status: 400 });
  }
  if (!ln || ln.length > 100) {
    return Response.json({ error: "Last name is required (max 100 chars)" }, { status: 400 });
  }
  if (pw.length < 8 || pw.length > 200) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (pw !== cpw) {
    return Response.json({ error: "Passwords do not match" }, { status: 400 });
  }

  const ip = clientIp(req);
  const ipRetry = checkRateLimit(`signup:ip:${ip}`, IP_LIMIT);
  if (ipRetry !== null) {
    return Response.json({ error: "Too many signup attempts. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(ipRetry) },
    });
  }
  const emailRetry = checkRateLimit(`signup:email:${normalizedEmail}`, EMAIL_LIMIT);
  if (emailRetry !== null) {
    return Response.json({ error: "Too many signup attempts for this email. Try again later." }, {
      status: 429,
      headers: { "Retry-After": String(emailRetry) },
    });
  }

  const pool = getPool();

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rowCount && existing.rowCount > 0) {
    return Response.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(pw, 10);
  const verificationToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let userId: number;
  try {
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [normalizedEmail, passwordHash, fn, ln, verificationToken, expires]
    );
    userId = inserted.rows[0].id;
  } catch (err: unknown) {
    // unique violation on email — raced insert
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }
    console.error("signup insert failed:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    await sendVerificationEmail(normalizedEmail, verificationToken, fn);
  } catch (err) {
    console.error("verification email failed:", err);
    // Don't pretend success — remove the row so the user can retry cleanly.
    await pool.query("DELETE FROM users WHERE id = $1", [userId]).catch(() => {});
    return Response.json({ error: "Could not send verification email. Please try again." }, { status: 500 });
  }

  void telegramNotify("signup", {
    name: `${fn} ${ln}`.trim(),
    email: normalizedEmail,
    extra: `ID ${userId}`,
  });

  return Response.json({ ok: true });
}
