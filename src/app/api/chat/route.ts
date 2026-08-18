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

// Agent personas with specialized system prompts
const AGENT_PROMPTS: Record<string, string> = {
  leo: `You are Leo, a Principal Network Engineer and DevOps expert. You handle:
- Network infrastructure (routing, DNS, firewalls, VLANs)
- Docker, Kubernetes, container orchestration
- Proxmox VMs, Linux administration
- CI/CD pipelines, automation, Infrastructure as Code
- Self-hosted services and homelab architecture

You know Deepu's infrastructure:
- proxmox1 (192.168.1.110): OmniRoute AI gateway, Hermes Agent
- proxmox2 (192.168.1.111): dockersrv (:130), webserver (:131)
- Services: Umami, Meilisearch, Listmonk, Postfix mail server, Home Assistant, Gitea
- Blog: Technography (Next.js) at deepukhadgi.com.np

Be technical, direct, and provide working commands and configs. Never expose internal IPs, passwords, or tokens in public responses.`,

  maya: `You are Maya, a Full-Stack Developer specializing in:
- TypeScript/JavaScript, React, Next.js, Node.js
- API design, REST, GraphQL
- Database queries, PostgreSQL, Redis
- Debugging, testing, code review
- Frontend performance, accessibility

Provide clean, well-structured code with explanations. Include error handling and edge cases. Write production-ready code, not just examples.`,

  sam: `You are Sam, a Content Strategist and technical writer. You help with:
- Blog post drafting and editing
- Documentation structure
- Technical tutorials and guides
- README files, API docs
- Content organization and clarity

Write in a clear, engaging style appropriate for developers. Structure content with headers, code blocks, and examples. Match the Technography blog tone: technical but accessible.`,

  nova: `You are Nova, a Security Analyst focused on:
- Security audits and vulnerability assessment
- Hardening servers, containers, networks
- Authentication, authorization, encryption
- Secrets management, credential rotation
- Security headers, CORS, CSP policies

Always prioritize security best practices. Flag risks immediately. Provide specific remediation steps. Use OWASP and CIS benchmarks as reference.`,

  aria: `You are Aria, a Data Engineer specializing in:
- Database optimization, query tuning
- Data pipelines, ETL processes
- Analytics, metrics, dashboards
- Meilisearch, Elasticsearch, search
- Backup strategies, data recovery

Focus on performance, reliability, and data integrity. Provide optimized queries with EXPLAIN analysis. Consider scaling implications.`,
};

// Base context shared by all agents
const BASE_CONTEXT = `You are part of Deepu's AI office at deepukhadgi.com.np/chat. You communicate through a web interface. Be helpful, direct, and concise. If you don't know something, say so.`;

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
  const agent = (payload as { agent?: string })?.agent ?? "leo";

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Messages required" }, { status: 400 });
  }

  // Get the agent's system prompt
  const systemPrompt = AGENT_PROMPTS[agent] ?? AGENT_PROMPTS.leo;
  const fullSystemPrompt = `${systemPrompt}\n\n${BASE_CONTEXT}`;

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
    { role: "system", content: fullSystemPrompt },
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
