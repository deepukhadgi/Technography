"use client";

import { useCallback, useEffect, useState } from "react";

type Comment = {
  id: number;
  postSlug: string;
  authorName: string;
  body: string;
  parentId: number | null;
  createdAt: string;
  likes: number;
  dislikes: number;
  myVote: -1 | 0 | 1;
};

export default function CommentsSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [hp, setHp] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voteBusy, setVoteBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { comments: Comment[] };
      setComments(data.comments);
      setError(null);
    } catch {
      setError("Could not load comments.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postSlug: slug,
          authorName,
          body,
          hp,
          parentId: replyingTo?.id ?? null,
          notifyEmail: notifyEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not post comment.");
        return;
      }
      setAuthorName("");
      setBody("");
      setNotifyEmail("");
      setReplyingTo(null);
      await load();
    } catch {
      setError("Could not post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(commentId: number, value: 1 | -1) {
    setVoteBusy(commentId);
    setError(null);
    try {
      const res = await fetch("/api/comments/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, value }),
      });
      if (!res.ok) {
        setError("Vote failed. Please try again.");
        return;
      }
      const data = (await res.json()) as { likes: number; dislikes: number; myVote: number };
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, likes: data.likes, dislikes: data.dislikes, myVote: data.myVote as -1 | 0 | 1 }
            : c
        )
      );
    } catch {
      setError("Vote failed. Please try again.");
    } finally {
      setVoteBusy(null);
    }
  }

  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesOf = (id: number) => comments.filter((c) => c.parentId === id);

  return (
    <section className="mt-14 border-t border-line pt-8" id="comments">
      <h2 className="font-mono text-xl font-bold">
        comments{" "}
        <span className="text-accent">
          ({comments.length})
        </span>
      </h2>

      {/* form */}
      <form
        onSubmit={submitComment}
        className="mt-5 rounded border border-line bg-panel p-4"
      >
        {/* honeypot — humans never see or fill this */}
        <input
          type="text"
          name="hp"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />
        {replyingTo && (
          <p className="mb-3 flex items-center justify-between gap-2 rounded border border-accent/30 bg-accent/5 px-3 py-2 font-mono text-xs text-accent">
            <span>
              → replying to <strong>{replyingTo.authorName}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="underline hover:opacity-70"
            >
              cancel
            </button>
          </p>
        )}
        <label className="block font-mono text-xs text-dim" htmlFor="c-author">
          name
        </label>
        <input
          id="c-author"
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={80}
          required
          placeholder="anonymous"
          className="mt-1 w-full rounded border border-line bg-bg px-3 py-3 font-mono text-base text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
        />
        <label className="mt-3 block font-mono text-xs text-dim" htmlFor="c-body">
          comment
        </label>
        <textarea
          id="c-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          required
          rows={4}
          placeholder="say something…"
          className="mt-1 w-full resize-y rounded border border-line bg-bg px-3 py-3 font-mono text-base text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
        />
        <label
          className="mt-3 flex items-center gap-2 font-mono text-xs text-dim"
          htmlFor="c-notify"
        >
          <input
            id="c-notify"
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            maxLength={200}
            placeholder="you@example.com"
            className="w-56 rounded border border-line bg-bg px-3 py-2 font-mono text-sm text-fg placeholder:text-dim/50 focus:border-accent focus:outline-none"
          />
          <span>email me when someone replies</span>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded border border-accent/40 bg-accent/10 px-4 py-3 font-mono text-sm text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "posting…" : "post comment"}
          </button>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        </div>
      </form>

      {/* list */}
      <div className="mt-6">
        {loading && <p className="font-mono text-xs text-dim">loading comments…</p>}

        {!loading && comments.length === 0 && (
          <p className="font-mono text-xs text-dim">
            <span className="text-accent">$</span> no comments yet — be the first
          </p>
        )}

        {!loading &&
          topLevel.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              replies={repliesOf(c.id)}
              vote={vote}
              voteBusy={voteBusy}
              onReply={setReplyingTo}
            />
          ))}
      </div>
    </section>
  );
}

function CommentThread({
  comment: c,
  replies,
  vote,
  voteBusy,
  onReply,
}: {
  comment: Comment;
  replies: Comment[];
  vote: (id: number, value: 1 | -1) => Promise<void>;
  voteBusy: number | null;
  onReply: (c: Comment) => void;
}) {
  return (
    <div id={`comment-${c.id}`} className="scroll-mt-20">
      <CommentBody comment={c} vote={vote} voteBusy={voteBusy} onReply={onReply} />
      {replies.length > 0 && (
        <div className="ml-5 border-l border-line pl-4 sm:ml-8">
          {replies.map((r) => (
            <CommentBody
              key={r.id}
              comment={r}
              vote={vote}
              voteBusy={voteBusy}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentBody({
  comment: c,
  vote,
  voteBusy,
  onReply,
}: {
  comment: Comment;
  vote: (id: number, value: 1 | -1) => Promise<void>;
  voteBusy: number | null;
  onReply: (c: Comment) => void;
}) {
  return (
    <div className="border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-dim">
        <span className="text-accent">{c.authorName}</span>
        <span className="text-line">|</span>
        <time dateTime={c.createdAt}>
          {new Date(c.createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{c.body}</p>
      <div className="mt-2 flex items-center gap-4 font-mono text-xs">
        <button
          type="button"
          onClick={() => vote(c.id, 1)}
          disabled={voteBusy === c.id}
          className={`flex items-center gap-1 rounded p-2 transition-colors disabled:opacity-50 ${
            c.myVote === 1 ? "text-accent" : "text-dim hover:text-accent"
          }`}
          aria-label="like"
        >
          <span aria-hidden>▲</span>
          <span>{c.likes}</span>
        </button>
        <button
          type="button"
          onClick={() => vote(c.id, -1)}
          disabled={voteBusy === c.id}
          className={`flex items-center gap-1 rounded p-2 transition-colors disabled:opacity-50 ${
            c.myVote === -1 ? "text-accent" : "text-dim hover:text-accent"
          }`}
          aria-label="dislike"
        >
          <span aria-hidden>▼</span>
          <span>{c.dislikes}</span>
        </button>
        <button
          type="button"
          onClick={() => onReply(c)}
          className="rounded p-2 text-dim transition-colors hover:text-accent"
        >
          reply
        </button>
      </div>
    </div>
  );
}
