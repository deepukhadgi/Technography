import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { generateSecret, generateURI, verify } from "otplib";

/**
 * TOTP / 2FA helpers.
 *
 * - Secrets are generated with `otplib` (Google Authenticator compatible:
 *   30s period, 6 digits, SHA1).
 * - Secrets are encrypted at rest (AES-256-GCM) with a key derived from
 *   SESSION_SECRET before being stored in `users.totp_secret`.
 * - The pre-login 2FA handoff uses a short-lived HMAC-signed token
 *   (5 minute expiry, no extra JWT dependency).
 */

const SECRET = process.env.SESSION_SECRET ?? "dev-fallback";

// ---- TOTP settings (standard Google Authenticator compatibility) ----
export const TOTP_ISSUER = "Technography";
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";
/** Accept codes from ±1 time step (30s) to tolerate minor clock drift. */
const TOTP_EPOCH_TOLERANCE = TOTP_PERIOD;

// ---- Temporary token settings (pre-login 2FA handoff) ----
const TEMP_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes max, per security policy

const BASE32_RE = /^[A-Z2-7]+={0,6}$/i;

/** Generate a new random base32 TOTP secret (32 bytes = 256 bits). */
export function generateTotpSecret(): string {
  return generateSecret({ length: 32 });
}

/** Build an otpauth:// URI for the QR code / authenticator app. */
export function buildOtpauthUri(email: string, secret: string): string {
  return generateURI({
    issuer: TOTP_ISSUER,
    label: email,
    secret,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
  });
}

/** Format validation for a user-supplied TOTP code. */
export function isValidTotpCode(code: unknown): code is string {
  return typeof code === "string" && /^\d{6}$/.test(code.trim());
}

/** Format validation for a user-supplied (new) base32 secret. */
export function isValidBase32Secret(secret: unknown): secret is string {
  return (
    typeof secret === "string" &&
    secret.length >= 16 &&
    secret.length <= 128 &&
    BASE32_RE.test(secret)
  );
}

/**
 * Verify a TOTP code against a plaintext secret.
 * Returns false (never throws) on any invalid input.
 */
export async function verifyTotpCode(
  code: string,
  secret: string
): Promise<boolean> {
  if (!isValidTotpCode(code) || !isValidBase32Secret(secret)) return false;
  try {
    const result = await verify({
      token: code.trim(),
      secret,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      epochTolerance: TOTP_EPOCH_TOLERANCE,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}

// ---- At-rest encryption (AES-256-GCM) ----

function encryptionKey(): Buffer {
  // Deterministic 32-byte key derived from SESSION_SECRET.
  return createHmac("sha256", "totp-secret-encryption").update(SECRET).digest();
}

const ENC_VERSION = "v1";

/** Encrypt a plaintext secret for storage. Format: v1:<base64(iv|tag|ct)>. */
export function encryptTotpSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_VERSION}:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

/** Decrypt a stored secret. Throws if the payload is corrupt or tampered. */
export function decryptTotpSecret(stored: string): string {
  const [version, payload] = stored.split(":");
  if (version !== ENC_VERSION || !payload) {
    throw new Error("Unsupported TOTP secret format");
  }
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("Corrupt TOTP secret payload");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// ---- Temporary pre-login token (HMAC-signed, 5 min expiry) ----

interface TempTokenPayload {
  userId: number;
  exp: number; // epoch ms
}

function hmacSign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("hex");
}

/** Sign a short-lived token binding the login attempt to a user id. */
export function signTempToken(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + TEMP_TOKEN_TTL_MS })
  ).toString("base64url");
  return `${payload}.${hmacSign(payload)}`;
}

/**
 * Validate a temporary token.
 * Returns the userId when the signature is valid and not expired, else null.
 */
export function verifyTempToken(token: string): number | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmacSign(payload);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as TempTokenPayload;
    if (
      typeof data.userId !== "number" ||
      typeof data.exp !== "number" ||
      data.exp <= Date.now()
    ) {
      return null;
    }
    return data.userId;
  } catch {
    return null;
  }
}
