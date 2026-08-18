"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
  timestamp: Date;
}

// Employee agents with specialized roles
const AGENTS = [
  {
    id: "leo",
    name: "Leo",
    role: "Principal Engineer",
    emoji: "🦁",
    description: "Network infrastructure, DevOps, systems administration",
    color: "text-accent",
    systemPrompt: `You are Leo, a Principal Network Engineer and DevOps expert. You handle:
- Network infrastructure (routing, DNS, firewalls)
- Docker, Kubernetes, container orchestration
- Proxmox VMs, Linux administration
- CI/CD pipelines, automation
- Infrastructure as code

Be technical, direct, and provide working commands and configs.`,
  },
  {
    id: "maya",
    name: "Maya",
    role: "Full-Stack Developer",
    emoji: "🦊",
    description: "Code, APIs, databases, debugging",
    color: "text-cyan",
    systemPrompt: `You are Maya, a Full-Stack Developer specializing in:
- TypeScript/JavaScript, React, Next.js, Node.js
- API design, REST, GraphQL
- Database queries, PostgreSQL, Redis
- Debugging, testing, code review
- Frontend performance, accessibility

Provide clean, well-structured code with explanations.`,
  },
  {
    id: "sam",
    name: "Sam",
    role: "Content Strategist",
    emoji: "📝",
    description: "Blog posts, documentation, technical writing",
    color: "text-amber-400",
    systemPrompt: `You are Sam, a Content Strategist and technical writer. You help with:
- Blog post drafting and editing
- Documentation structure
- Technical tutorials and guides
- README files, API docs
- Content organization and clarity

Write in a clear, engaging style appropriate for developers.`,
  },
  {
    id: "nova",
    name: "Nova",
    role: "Security Analyst",
    emoji: "🔐",
    description: "Security audits, hardening, best practices",
    color: "text-rose-400",
    systemPrompt: `You are Nova, a Security Analyst focused on:
- Security audits and vulnerability assessment
- Hardening servers, containers, networks
- Authentication, authorization, encryption
- Secrets management, credential rotation
- Security headers, CORS, CSP policies

Always prioritize security best practices and flag risks.`,
  },
  {
    id: "aria",
    name: "Aria",
    role: "Data Engineer",
    emoji: "📊",
    description: "Analytics, databases, data pipelines",
    color: "text-violet-400",
    systemPrompt: `You are Aria, a Data Engineer specializing in:
- Database optimization, query tuning
- Data pipelines, ETL processes
- Analytics, metrics, dashboards
- Meilisearch, Elasticsearch, search
- Backup strategies, data recovery

Focus on performance, reliability, and data integrity.`,
  },
] as const;

type AgentId = (typeof AGENTS)[number]["id"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [clearing, setClearing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentId>("leo");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentAgent = AGENTS.find((a) => a.id === selectedAgent) ?? AGENTS[0];

  // Check auth on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setAuthorized(data?.loggedIn === true);
      })
      .catch(() => setAuthorized(false));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      agent: selectedAgent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      agent: selectedAgent,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          agent: selectedAgent,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setAuthorized(false);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as { content?: string };
            if (parsed.content) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.content += parsed.content;
                }
                return updated;
              });
            }
          } catch {
            // Skip malformed
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          last.content = "Connection error. Please try again.";
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    if (clearing) return;
    setClearing(true);
    try {
      await fetch("/api/chat", { method: "DELETE" });
      setMessages([]);
    } catch (err) {
      console.error("Clear error:", err);
    } finally {
      setClearing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  // Loading state while checking auth
  if (authorized === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (!authorized) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded border border-line bg-panel/50 p-8 text-center">
          <h1 className="font-mono text-2xl font-bold">Access Denied</h1>
          <p className="mt-4 font-mono text-sm text-dim">
            This chat is private. Please{" "}
            <a href="/login" className="text-accent hover:underline">
              log in
            </a>{" "}
            to continue.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-8" style={{ height: "calc(100vh - 200px)" }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-sm text-dim">
            <span className="text-accent">$</span> ~/chat
          </p>
          <h1 className="mt-1 font-mono text-2xl font-bold">
            AI Office <span className="text-accent">/</span>
          </h1>
        </div>
        <button
          onClick={() => void clearHistory()}
          disabled={clearing || messages.length === 0}
          className="rounded border border-line px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:border-accent/50 hover:text-fg disabled:opacity-50"
        >
          {clearing ? "clearing..." : "clear history"}
        </button>
      </div>

      {/* Agent Picker */}
      <div className="mb-4">
        <button
          onClick={() => setShowAgentPicker(!showAgentPicker)}
          className="flex w-full items-center justify-between rounded border border-line bg-panel/50 px-4 py-3 text-left transition-colors hover:border-accent/50"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{currentAgent.emoji}</span>
            <div>
              <div className={`font-mono text-sm font-semibold ${currentAgent.color}`}>
                {currentAgent.name}
              </div>
              <div className="font-mono text-xs text-dim">{currentAgent.role}</div>
            </div>
          </div>
          <span className="text-dim">{showAgentPicker ? "▲" : "▼"}</span>
        </button>

        {showAgentPicker && (
          <div className="mt-2 grid grid-cols-1 gap-2 rounded border border-line bg-panel p-2 sm:grid-cols-2">
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgent(agent.id);
                  setShowAgentPicker(false);
                }}
                className={`flex items-center gap-3 rounded px-3 py-2 text-left transition-colors ${
                  selectedAgent === agent.id
                    ? "bg-accent/10 border border-accent/30"
                    : "hover:bg-panel/80 border border-transparent"
                }`}
              >
                <span className="text-xl">{agent.emoji}</span>
                <div className="min-w-0">
                  <div className={`font-mono text-sm font-semibold ${agent.color}`}>
                    {agent.name}
                  </div>
                  <div className="truncate font-mono text-xs text-dim">
                    {agent.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded border border-line bg-panel/30 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-4xl">{currentAgent.emoji}</div>
            <p className="font-mono text-sm text-dim">
              Ask {currentAgent.name} about {currentAgent.description.toLowerCase()}
            </p>
            <p className="mt-2 font-mono text-xs text-dim/60">
              Pick an agent above to switch specialties
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const msgAgent = AGENTS.find((a) => a.id === msg.agent) ?? AGENTS[0];
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 font-mono text-sm ${
                      msg.role === "user"
                        ? "bg-accent/20 text-fg"
                        : "bg-panel border border-line text-fg"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className={`mb-1 text-xs font-semibold ${msgAgent.color}`}>
                        {msgAgent.emoji} {msgAgent.name}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content || (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                          <span className="text-dim">{msgAgent.name} is thinking...</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-4 rounded border border-line bg-panel/50 p-3">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${currentAgent.name} about ${currentAgent.description.toLowerCase()}...`}
            disabled={loading}
            rows={1}
            className="flex-1 resize-none bg-transparent font-mono text-sm text-fg placeholder:text-dim/60 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded bg-accent px-4 py-2 font-mono text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : "send"}
          </button>
        </div>
      </div>
    </div>
  );
}
