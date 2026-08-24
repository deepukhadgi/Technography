"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{
    slug: string;
    title: string;
    date: string | null;
    tags: string[];
  }>;
}

export default function SearchAskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput("");
    setLoading(true);
    setError(null);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const res = await fetch("/api/rag-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: currentInput }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as {
        answer: string;
        sources?: Message["sources"];
      };

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          last.content = data.answer;
          last.sources = data.sources;
        }
        return updated;
      });
    } catch (err) {
      console.error("RAG search error:", err);
      setError(err instanceof Error ? err.message : "Failed to get answer. Please try again.");
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          last.content = "Error: Could not get answer. Please try again.";
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    setMessages([]);
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-8" style={{ height: "calc(100vh - 200px)" }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-sm text-dim">
            <span className="text-accent">$</span> ~/search-ask
          </p>
          <h1 className="mt-1 font-mono text-2xl font-bold">
            Ask the Blog <span className="text-accent">/</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-dim">
            RAG-powered search — ask questions about any post content
          </p>
        </div>
        <button
          onClick={clearHistory}
          disabled={messages.length === 0}
          className="rounded border border-line px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:border-accent/50 hover:text-fg disabled:opacity-50"
        >
          clear history
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded border border-line bg-panel/30 p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-4xl">🤖</div>
            <p className="font-mono text-sm text-dim max-w-md">
              Ask anything about the blog — I&apos;ll search the posts and give you a cited answer.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                "How do I set up Proxmox VMs?",
                "What Docker tips are covered?",
                "Networking with WireGuard",
                "Self-hosting Meilisearch",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    void sendMessage();
                  }}
                  disabled={loading}
                  className="rounded border border-line bg-panel px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="mt-4 font-mono text-xs text-dim/60">
              Press <kbd className="rounded border border-line px-1">Enter</kbd> to send · <kbd className="rounded border border-line px-1">Shift</kbd>+<kbd className="rounded border border-line px-1">Enter</kbd> for new line
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 font-mono text-sm ${
                    msg.role === "user"
                      ? "bg-accent/20 text-fg"
                      : "bg-panel border border-line text-fg"
                  }`}
                >
                  <div className="flex items-end justify-between gap-2 mb-1">
                    <span className="text-xs text-dim">{formatTime(msg.timestamp)}</span>
                    {msg.role === "user" && <span className="text-xs text-accent">you</span>}
                    {msg.role === "assistant" && <span className="text-xs text-cyan">assistant</span>}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content || (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <span className="text-dim">thinking...</span>
                      </span>
                    )}
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="mt-2">
                      <summary className="flex items-center gap-1.5 cursor-pointer font-mono text-xs text-dim hover:text-accent">
                        <span>Sources ({msg.sources.length})</span>
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="mt-2 space-y-1 pl-2 border-l border-line/50">
                        {msg.sources.map((src, i) => (
                          <a
                            key={src.slug}
                            href={`/blog/${src.slug}`}
                            className="block font-mono text-xs text-dim hover:text-accent"
                          >
                            [{i + 1}] {src.title} {src.date && `· ${src.date}`}
                          </a>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {error && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded border border-red-400/50 bg-red-900/20 px-4 py-2 font-mono text-xs text-red-400 animate-slide-up">
            {error}
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
            placeholder="Ask a question about the blog..."
            disabled={loading}
            rows={1}
            className="flex-1 resize-none bg-transparent font-mono text-sm text-fg placeholder:text-dim/60 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded bg-accent px-4 py-2 font-mono text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "..." : "ask"}
          </button>
        </div>
      </div>
    </div>
  );
}