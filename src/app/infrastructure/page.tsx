"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Public Infrastructure Dashboard
 *
 * Displays non-sensitive operational metrics:
 * - Blog content stats (posts, tags)
 * - Umami visitor analytics (if available)
 * - Listmonk subscriber count (if available)
 * - Service health indicators
 */

type InfraStats = {
  generatedAt: string;
  latencyMs: number;
  blog: {
    posts: { total: number; published: number; premium: number };
    tags: { count: number; list: string[] };
  };
  umami: {
    visitors: number | null;
    pageviews: number | null;
    available: boolean;
    note: string;
  };
  listmonk: {
    subscribers: number | null;
    available: boolean;
    note: string;
  };
  services: Array<{
    name: string;
    status: "operational" | "degraded" | "down";
    description: string;
  }>;
};

function formatNumber(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: "operational" | "degraded" | "down" }) {
  const styles = {
    operational: "bg-accent/20 text-accent border-accent/30",
    degraded: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    down: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const labels = {
    operational: "● operational",
    degraded: "● degraded",
    down: "● down",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  trend,
}: {
  label: string;
  value: string;
  subtitle?: string;
  trend?: string;
}) {
  return (
    <div className="rounded border border-line bg-panel p-5 transition-colors hover:border-accent/50">
      <p className="font-mono text-xs text-dim">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold text-fg">{value}</p>
      {subtitle && <p className="mt-1 font-mono text-xs text-dim">{subtitle}</p>}
      {trend && (
        <p className="mt-1 font-mono text-xs text-accent">{trend}</p>
      )}
    </div>
  );
}

function ServiceRow({
  name,
  status,
  description,
}: {
  name: string;
  status: "operational" | "degraded" | "down";
  description: string;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-line bg-panel/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-fg">{name}</span>
        <StatusBadge status={status} />
      </div>
      <p className="font-mono text-xs text-dim">{description}</p>
    </div>
  );
}

export default function InfrastructurePage() {
  const [stats, setStats] = useState<InfraStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        const res = await fetch("/api/infra-stats", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as InfraStats;
        if (mounted) setStats(data);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchStats();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-grid min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <p className="font-mono text-sm text-dim">
            <span className="text-accent">$</span> cat ./infrastructure.json
          </p>
          <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
            Infrastructure <span className="text-accent">Dashboard</span>
          </h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded border border-line bg-panel p-5 animate-pulse">
                <div className="h-4 w-1/4 bg-line/50 rounded" />
                <div className="mt-3 h-8 w-3/4 bg-line/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-grid min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <p className="font-mono text-sm text-dim">
            <span className="text-accent">$</span> cat ./infrastructure.json
          </p>
          <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
            Infrastructure <span className="text-accent">Dashboard</span>
          </h1>
          <div className="mt-8 rounded border border-red-500/30 bg-red-500/10 p-5 text-red-400">
            <p className="font-mono">Failed to load infrastructure stats</p>
            <p className="mt-2 text-sm text-dim">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded border border-accent/50 px-4 py-2 font-mono text-sm text-accent hover:bg-accent/10"
            >
              retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-grid min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-16">
        {/* HEADER */}
        <p className="font-mono text-sm text-dim">
          <span className="text-accent">$</span> cat ./infrastructure.json
        </p>
        <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
          Infrastructure <span className="text-accent">Dashboard</span>
        </h1>
        <p className="mt-2 text-dim">
          Public operational metrics — no internal IPs, no sensitive data
        </p>
        <p className="mt-1 font-mono text-xs text-dim/70">
          Last updated: {formatDate(stats.generatedAt)} · API latency:{' '}
          {stats.latencyMs}ms
        </p>

        {/* BLOG STATS */}
        <section className="mt-12">
          <h2 className="font-mono text-lg font-bold">
            <span className="text-accent">#</span> blog
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="total posts"
              value={formatNumber(stats.blog.posts.total)}
              subtitle={
                stats.blog.posts.published > 0
                  ? `${stats.blog.posts.published} published · ${stats.blog.posts.premium} premium`
                  : "no posts yet"
              }
            />
            <StatCard
              label="tags"
              value={formatNumber(stats.blog.tags.count)}
              subtitle="click to filter"
              trend="view all →"
            />
            <StatCard
              label="published"
              value={formatNumber(stats.blog.posts.published)}
              subtitle="publicly readable"
            />
            <StatCard
              label="premium"
              value={formatNumber(stats.blog.posts.premium)}
              subtitle="subscriber-only"
            />
          </div>

          {/* Tag cloud */}
          {stats.blog.tags.list.length > 0 && (
            <div className="mt-6">
              <p className="font-mono text-xs text-dim mb-3">
                <span className="text-accent">$</span> tags
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.blog.tags.list.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog/tag/${encodeURIComponent(tag)}`}
                    className="rounded border border-line bg-panel px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ANALYTICS */}
        <section className="mt-12">
          <h2 className="font-mono text-lg font-bold">
            <span className="text-accent">#</span> analytics (Umami)
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="visitors (30d)"
              value={formatNumber(stats.umami.visitors)}
              subtitle={stats.umami.note}
            />
            <StatCard
              label="pageviews (30d)"
              value={formatNumber(stats.umami.pageviews)}
              subtitle={stats.umami.available ? "privacy-friendly, no cookies" : "unavailable"}
            />
          </div>
          {!stats.umami.available && (
            <p className="mt-3 font-mono text-xs text-dim">
              Umami public API not configured. Set NEXT_PUBLIC_UMAMI_URL and
              UMAMI_WEBSITE_ID to enable.
            </p>
          )}
        </section>

        {/* NEWSLETTER */}
        <section className="mt-12">
          <h2 className="font-mono text-lg font-bold">
            <span className="text-accent">#</span> newsletter (Listmonk)
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="subscribers"
              value={formatNumber(stats.listmonk.subscribers)}
              subtitle={stats.listmonk.note}
            />
            <StatCard
              label="status"
              value={stats.listmonk.available ? "connected" : "unavailable"}
              subtitle="active confirmed subscribers"
            />
          </div>
          {!stats.listmonk.available && (
            <p className="mt-3 font-mono text-xs text-dim">
              Listmonk not configured. Set LISTMONK_URL, LISTMONK_USER,
              LISTMONK_TOKEN, and LISTMONK_LIST_ID to enable.
            </p>
          )}
        </section>

        {/* SERVICE STATUS */}
        <section className="mt-12">
          <h2 className="font-mono text-lg font-bold">
            <span className="text-accent">#</span> service status
          </h2>
          <div className="mt-6 space-y-2">
            {stats.services.map((svc) => (
              <ServiceRow key={svc.name} {...svc} />
            ))}
          </div>
          <p className="mt-4 font-mono text-xs text-dim/70">
            Status indicators are static placeholders — real health checks
            require internal monitoring (Prometheus, Uptime Kuma, etc.).
          </p>
        </section>

        {/* FOOTER NOTE */}
        <section className="mt-12 rounded border border-line bg-panel/50 p-4">
          <p className="font-mono text-xs text-dim">
            <span className="text-accent">$</span> echo "data source: local
            filesystem (posts), Umami public API, Listmonk API (server-side)"
          </p>
          <p className="mt-1 font-mono text-xs text-dim/70">
            All endpoints are read-only. No authentication required. No internal
            network topology exposed.
          </p>
        </section>
      </div>
    </div>
  );
}