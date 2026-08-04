const WINDOW_MS = 60 * 60 * 1000; // 1 hour

const buckets = new Map<string, number[]>();

/**
 * Sliding-window in-memory rate limiter.
 * Returns null when the request is allowed (and records it),
 * or the number of seconds to retry after when it is blocked.
 */
export function checkRateLimit(key: string, max: number): number | null {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= max) {
    const oldest = recent[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    buckets.set(key, recent);
    return retryAfter;
  }

  recent.push(now);
  buckets.set(key, recent);

  // opportunistic cleanup to keep the map bounded
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || now - v[v.length - 1] >= WINDOW_MS) buckets.delete(k);
    }
  }

  return null;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
