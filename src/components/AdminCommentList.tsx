"use client";

import { useCallback, useEffect, useState } from "react";

type PendingComment = {
  id: number;
  post_slug: string;
  author_name: string;
  body: string;
  parent_id: number | null;
  notify_email: string | null;
  created_at: string;
  is_approved: boolean;
};

export default function AdminCommentList() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/moderation", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { comments: PendingComment[] };
      setComments(data.comments);
      setError(null);
    } catch {
      setError("Could not load pending comments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: number, action: "approve" | "hide") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `Could not ${action} comment.`);
        return;
      }
      await load();
    } catch {
      setError(`Could not ${action} comment.`);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this comment permanently?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moderation?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not delete comment.");
        return;
      }
      await load();
    } catch {
      setError("Could not delete comment.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="mt-8 font-mono text-sm text-dim">loading pending comments…</p>;
  }

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <p className="rounded border border-line bg-panel/50 p-3 font-mono text-sm text-fg">
          {error}
        </p>
      )}

      {comments.length === 0 ? (
        <p className="rounded border border-line bg-panel/50 p-6 font-mono text-sm text-dim">
          No pending comments — all caught up. <span className="text-accent">✓</span>
        </p>
      ) : (
        comments.map((c) => (
          <article
            key={c.id}
            className="rounded border border-line bg-panel/50 p-5"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-dim">
              <span className="text-accent">#{c.id}</span>
              <span>{c.author_name}</span>
              <span className="text-dim/60">on {c.post_slug}</span>
              {c.parent_id !== null && <span>↳ reply to #{c.parent_id}</span>}
              <span className="ml-auto">{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-fg">{c.body}</p>
            {c.notify_email && (
              <p className="mt-2 font-mono text-xs text-dim">notify: {c.notify_email}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void act(c.id, "approve")}
                disabled={busyId === c.id}
                className="rounded border border-line bg-panel px-3 py-1.5 font-mono text-xs text-accent transition hover:border-accent/60 disabled:opacity-50"
              >
                {busyId === c.id ? "…" : "approve"}
              </button>
              <button
                type="button"
                onClick={() => void act(c.id, "hide")}
                disabled={busyId === c.id}
                className="rounded border border-line bg-panel px-3 py-1.5 font-mono text-xs text-dim transition hover:text-fg disabled:opacity-50"
              >
                {busyId === c.id ? "…" : "hide"}
              </button>
              <button
                type="button"
                onClick={() => void remove(c.id)}
                disabled={busyId === c.id}
                className="rounded border border-line bg-panel px-3 py-1.5 font-mono text-xs text-fg transition hover:border-fg/60 disabled:opacity-50"
              >
                {busyId === c.id ? "…" : "delete"}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
