import { NextRequest } from "next/server";
import { telegramNotify } from "@/lib/telegramNotify";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const LISTMONK_URL = process.env.LISTMONK_URL ?? (() => { throw new Error("LISTMONK_URL must be set in .env.local — never use the default fallback"); })();
const LISTMONK_USER = process.env.LISTMONK_USER ?? (() => { throw new Error("LISTMONK_USER must be set in .env.local — never use the default fallback"); })();
const LISTMONK_TOKEN = process.env.LISTMONK_TOKEN ?? (() => { throw new Error("LISTMONK_TOKEN must be set in .env.local — never use the default fallback"); })();
const LISTMONK_LIST_ID = process.env.LISTMONK_LIST_ID ?? (() => { throw new Error("LISTMONK_LIST_ID must be set in .env.local — never use the default fallback"); })();

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200;
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, name, hp } = (payload ?? {}) as {
    email?: unknown;
    name?: unknown;
    hp?: unknown;
  };

  // Honeypot — bots get a fake success.
  if (typeof hp === "string" && hp.length > 0) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
  const nameStr = typeof name === "string" ? name.trim().replace(/<[^>]*>/g, "").slice(0, 80) : "";

  if (!isEmail(emailStr)) {
    return Response.json({ error: "Please enter a valid email address" }, { status: 400 });
  }
  if (!LISTMONK_TOKEN) {
    return Response.json({ error: "Newsletter not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${LISTMONK_URL}/api/subscribers`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${LISTMONK_USER}:${LISTMONK_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailStr,
        name: nameStr || undefined,
        lists: [Number(LISTMONK_LIST_ID)],
        preconfirm_subscriptions: true,
      }),
      cache: "no-store",
    });

    // Already-subscribed / exists errors are treated as success (idempotent UX).
    if (res.status === 200 || res.status === 201) {
      void telegramNotify("newsletter", { name: nameStr, email: emailStr });
      return Response.json({ ok: true }, { status: 201 });
    }
    if (res.status === 400) {
      const body = await res.json().catch(() => null);
      const msg = (body as { error?: string })?.error ?? "";
      if (/already|exists|duplicate/i.test(msg)) {
        void telegramNotify("newsletter", { name: nameStr, email: emailStr, extra: "Already subscribed" });
        return Response.json({ ok: true, already: true }, { status: 201 });
      }
    }
    console.error("Listmonk subscribe error", res.status);
    return Response.json({ error: "Could not subscribe — try again later" }, { status: 502 });
  } catch {
    return Response.json({ error: "Could not subscribe — try again later" }, { status: 502 });
  }
}