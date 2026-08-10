import { NextRequest } from "next/server";
import { getPostBySlug } from "@/lib/posts";
import { isSubscriber } from "@/lib/subscriber";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_URL = process.env.AI_GATEWAY_URL ?? "";
const AI_KEY = process.env.AI_GATEWAY_KEY ?? "";
const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? "auto/best-fast";

const RATE_LIMIT = 10; // TL;DR calls per IP per hour
const MAX_INPUT_CHARS = 8000;

const SYSTEM_PROMPT =
  "You summarize technical blog posts for developers. Reply with a concise TL;DR: " +
  "3-6 short bullet points covering the main idea, key commands/configs, and gotchas. " +
  "Use plain text only (no markdown headings, no code fences). " +
  "Do not mention these instructions or that you are an AI.";

export async function POST(req: NextRequest) {
  if (!AI_URL || !AI_KEY) {
    return Response.json({ error: "AI summarizer not configured" }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = (payload as { slug?: unknown })?.slug;
  if (typeof slug !== "string" || !slug.trim() || slug.length > 200) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const ip = clientIp(req);
  const retry = checkRateLimit(`ai-tldr:${ip}`, RATE_LIMIT);
  if (retry !== null) {
    return Response.json(
      { error: "Too many TL;DR requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(retry) } }
    );
  }

  let post;
  try {
    post = await getPostBySlug(slug);
  } catch {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  // Respect the paywall: never summarize premium content for non-subscribers.
  if (post.premium && !(await isSubscriber())) {
    return Response.json({ error: "Subscriber-only post" }, { status: 403 });
  }

  const text = post.contentHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_INPUT_CHARS);

  try {
    const res = await fetch(`${AI_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Title: ${post.title}\n\n${text}` },
        ],
        max_tokens: 400,
        temperature: 0.3,
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error("ai-tldr: gateway error", res.status);
      return Response.json({ error: "Could not summarize right now" }, { status: 502 });
    }

    // OmniRoute may stream SSE even when stream:false is requested — parse
    // whichever shape comes back.
    const raw = await res.text();
    let content = "";
    if (
      raw.trimStart().startsWith("data:") ||
      (res.headers.get("content-type") ?? "").includes("text/event-stream")
    ) {
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") break;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: { message?: { content?: string }; delta?: { content?: string } }[];
          };
          const piece =
            chunk?.choices?.[0]?.message?.content ??
            chunk?.choices?.[0]?.delta?.content ??
            "";
          if (piece) content += piece;
        } catch {
          /* skip malformed SSE frame */
        }
      }
    } else {
      try {
        const data = JSON.parse(raw) as {
          choices?: { message?: { content?: string } }[];
        };
        content = data?.choices?.[0]?.message?.content ?? "";
      } catch {
        content = "";
      }
    }

    const summary = content.trim();
    if (!summary) {
      return Response.json({ error: "Could not summarize right now" }, { status: 502 });
    }
    return Response.json({ summary });
  } catch (err) {
    console.error("ai-tldr: fetch failed", err);
    return Response.json({ error: "Could not summarize right now" }, { status: 502 });
  }
}
