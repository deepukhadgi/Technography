import { createHmac, randomUUID } from "crypto";

export const VOTER_COOKIE = "tg_voter";
const VOTER_TTL_SECONDS = 60 * 60 * 24 * 365; // ~1 year

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

/** True if the cookie value is a properly signed `<uuid>.<hmac>`. */
export function isValidVoterToken(raw: string | undefined): boolean {
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return false;
  const uuid = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  if (mac.length !== 64) return false;
  const expected = sign(uuid);
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Extract the voter uuid from a signed cookie, or mint a fresh one. */
export function getOrCreateVoter(raw: string | undefined): {
  voterKey: string;
  isNew: boolean;
} {
  if (raw !== undefined && isValidVoterToken(raw)) {
    const dot = raw.lastIndexOf(".");
    return { voterKey: raw.slice(0, dot), isNew: false };
  }
  const uuid = randomUUID();
  return { voterKey: uuid, isNew: true };
}

export function buildVoterCookieValue(uuid: string): string {
  return `${uuid}.${sign(uuid)}`;
}

export function voterCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VOTER_TTL_SECONDS,
  };
}
