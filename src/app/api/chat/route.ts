import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AI_URL = process.env.AI_GATEWAY_URL ?? "";
const AI_KEY = process.env.AI_GATEWAY_KEY ?? "";
const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? "auto/best-fast";

// Only allow the owner to access chat
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "deepu.khadgi@gmail.com";

const SYSTEM_PROMPT = `You are Leo, an elite Principal Network Engineer and DevOps expert. You are Deepu's personal AI assistant, running on his self-hosted Hermes Agent infrastructure.

You help with:
- Network infrastructure, Docker, Proxmox VMs, Linux administration
- Coding, debugging, and DevOps automation
- Blog content and technical writing for deepukhadgi.com.np
- Self-hosted services and homelab management

Be direct, technical, and concise. You communicate via Telegram normally, but right now you're chatting through the web interface on deepukhadgi.com.np/chat.

You know about his infrastructure:
- proxmox1 (192.168.1.110): OmniRoute AI gateway, Hermes Agent
- proxmox2 (192.168.1.111): dockersrv (:130), webserver (:131)
- Services: Umami, Meilisearch, Listmonk, Postfix mail server, Home Assistant, Gitea
- Blog: Technography (Next.js) at deepukhadgi.com.np

Never expose internal IPs, passwords, or tokens in responses.`;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(req: NextRequest) {
  // Auth check - only owner can access
  const session = await getSession();
  if (!session || session.email !== OWNER_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!AI_URL || !AI_KEY) {
    return Response.json({ error: "AI gateway not configured" }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = (payload as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Messages required" }, { status: 400 });
  }

  // Load recent conversation context from DB for continuity
  const pool = getPool();
  const historyResult = await pool.query<{ role: string; content: string }>(
    `SELECT role, content FROM chat_messages 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [session.userId]
  );

  // Build context: system prompt + recent history + new messages
  const contextMessages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...historyResult.rows.reverse().map((m) => m as Message),
    ...(messages as Message[]),
  ];

  try {
    const res = await fetch(`${AI_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: contextMessages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      console.error("chat: gateway error", res.status);
      return Response.json({ error: "AI gateway error" }, { status: 502 });
    }

    // Store user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      await pool.query(
        `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'user', $2)`,
        [session.userId, lastUserMsg.content]
      );
    }

    // Stream the response
    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;

              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data) as {
                  choices?: { delta?: { content?: string } }[];
                };
                const content = parsed?.choices?.[0]?.delta?.content ?? "";
                if (content) {
                  fullResponse += content;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed SSE
              }
            }
          }

          // Store assistant response
          if (fullResponse) {
            await pool.query(
              `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'assistant', $2)`,
              [session.userId, fullResponse]
            );
          }

          controller.close();
        } catch (err) {
          console.error("chat: stream error", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("chat: fetch failed", err);
    return Response.json({ error: "Could not reach AI gateway" }, { status: 502 });
  }
}

// Clear chat history
export async function DELETE() {
  const session = await getSession();
  if (!session || session.email !== OWNER_EMAIL) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  await pool.query(`DELETE FROM chat_messages WHERE user_id = $1`, [session.userId]);
  return Response.json({ success: true });
}
