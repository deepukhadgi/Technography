---
title: "Honcho Deep Dive Part 2: Production Tuning and Scaling"
date: "2026-08-06"
excerpt: "Six months of Honcho in production: queue backpressure, connection pooling, HNSW vector index tuning, backup drills, the upgrade path, and every failure mode I hit along the way."
tags: ["honcho", "ai", "memory", "performance", "subscriber-only"]
premium: true
---

In [Part 1](/blog/honcho-deep-dive) I published the exact configuration
that got Honcho running: the Compose stack, the Postgres tuning, the
dialectic engine settings, and the Hermes integration. This is the
sequel, written six months later — because "it runs" and "it survives
growth" are two completely different problems.

What changed: conversation volume roughly tripled, the database crossed
4GB, the reasoning queue started backing up during peak hours, and one
night the whole stack ground to a halt over a single misconfigured
setting. Every section below is something I had to break first.

<figure>
  <img src="/images/honcho-deep-dive-part-2-diagram.png" alt="Honcho Deep Dive Part 2: Production Tuning and Scaling architecture diagram" width="1200" height="600" loading="lazy" />
  <figcaption class="font-mono text-xs text-dim mt-2 text-center">Honcho Deep Dive Part 2: Production Tuning and Scaling system diagram</figcaption>
</figure>
## Where the pressure shows up

Honcho has three moving parts, and each fails differently under load:

| Component | Symptom of overload | First thing to check |
|-----------|--------------------|----------------------|
| Postgres | Slow writes, `too many connections` | Pool saturation, bloat |
| Redis | Queue depth climbing, jobs stuck | Memory pressure, eviction |
| API workers | Reasoning latency spikes | Worker count vs queue rate |

The Part 1 insight still holds: Honcho writes *a lot* — every turn
produces observations, reasoning jobs, and embedding writes. When
traffic tripled, the write path was the first casualty.

## 1. Connection pooling: pgbouncer in transaction mode

The first `too many connections` error appeared around 1,000
conversations/month. Honcho's workers each hold a pool of connections,
and 4 workers × default pool sizes burned through the
`max_connections = 100` ceiling from Part 1 fast.

The fix is not a bigger ceiling — it's a pooler in front of Postgres:

```yaml
  pgbouncer:
    image: edoburu/pgbouncer:latest
    container_name: honcho-pgbouncer
    restart: unless-stopped
    environment:
      - DB_HOST=db
      - DB_USER=honcho
      - DB_PASSWORD=***
      - DB_NAME=honcho
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=200
      - DEFAULT_POOL_SIZE=20
    ports:
      - "5432:5432"
```

Then point Honcho at the pooler instead of Postgres directly.

**Why `transaction` mode?** Honcho's workloads are short-lived
transactions, not long-lived sessions. Transaction pooling hands a
physical connection to a client for one transaction, then returns it to
the pool — 200 logical clients can share 20 physical connections.
Connection errors went to zero and Postgres CPU actually dropped. One
rule: keep `DEFAULT_POOL_SIZE` below `max_connections` divided by the
number of services hitting the database.

## 2. Queue backpressure: scaling workers correctly

The second failure mode was the reasoning queue: jobs backed up past
the point where they completed before the next batch — classic
head-of-line blocking. Queue depth climbed to several hundred, and
because every reasoning job competed for the same Postgres writes, the
whole API slowed with it.

The tempting fix is to crank `HONCHO_WORKER_COUNT` to 8 and call it
done. Wrong — the bottleneck was never raw CPU. Watch `jobs/stats` on
the API first: if jobs wait while workers idle, it's scheduling; if
workers are busy and jobs still queue, it's throughput — the model API
rate-limiting you, or the database falling behind. Mine was the model
API.

The fix that worked was layering, not brute force:

1. **Cap concurrency deliberately** — `HONCHO_MAX_CONCURRENT_JOBS=6`
   with 3 workers. More than the model API can serve just creates 429
   pile-ups and retries that *worsen* the bottleneck.
2. **Split the queues** — observations are cheap and fast, reasoning
   expensive and slow. A second worker replica that only pulls
   reasoning jobs keeps cheap jobs from starving behind expensive ones.
3. **Timeout is a backpressure valve** — a job stuck on a slow model
   call frees its worker slot after `HONCHO_JOB_TIMEOUT=300` instead of
   holding it forever.

Result: steady-state queue depth went from 200+ to under 10, with
reasoning latency under 30 seconds at peak.

## 3. Vector indexes: HNSW vs the default

Honcho stores embeddings in Postgres, and by default similarity search
uses an IVFFlat index — fine at 100K vectors, annoying at 1M+. It needs
its list count tuned to the dataset and degrades as the table grows
unless rebuilt, and its recall was inconsistent: it occasionally missed
the right memory, which made Hermes context feel "forgetful".

The fix is HNSW, a graph index that needs no dataset-size tuning:

```sql
CREATE INDEX IF NOT EXISTS observations_embedding_hnsw
ON observations USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 200);
```

- `m = 16` — edges per node (higher = better recall, more memory).
- `ef_construction = 200` — build-time quality; the sweet spot.

Confirm the planner uses it — `EXPLAIN (ANALYZE)` on a `<=>` ordered
query should show `Index Scan using observations_embedding_hnsw`.
Top-5 memory retrieval dropped from ~80ms to ~5ms with deterministic
recall. HNSW builds slower than IVFFlat, so migrate during a
maintenance window with `maintenance_work_mem` raised.

## 4. Backups: the drill matters more than the dump

Honcho's data *is* the system's memory — losing it isn't a "restore
from yesterday" event, it's losing the model of who the user is. My
stack, hardened over two incidents:

**Daily logical dump** — `pg_dump -Fc` piped to gzip, 14 days retained.
**Continuous WAL archiving** for point-in-time recovery —
`archive_mode = on` with `archive_command` shipping segments to object
storage. Dumps *plus* WAL means a crash costs minutes of writes, not a
day.

**The part everyone skips: restore drills.** I run a monthly restore
into a scratch database on a second machine, then hit the health
endpoint and confirm context retrieval works. A backup that has never
been restored is a folder of hope — the first drill found a bug in my
dump script; the second took eleven minutes end to end.

## 5. The upgrade path

Honcho ships fast. Rules I now follow:

1. **Pin the image digest** in Compose — `latest` will eventually burn
   you.
2. **Read the migration notes** before pulling — running migration SQL
   against a live database without checking is how you get a locked
   table at 2am.
3. **Upgrade in three steps**: pull the new image, run migrations
   against the scratch DB, then flip the main service with a
   `docker compose up -d` restart. Keep the old image for a week;
   rollback is a one-line change.
4. **Canary by workspace** if you run several: point the least critical
   workspace at the new version first and watch its job stats for 24
   hours.

## 6. Failure modes I actually hit

- **Embedding API rate limit at index time.** A reindexing burst of
  50K embeddings will hit the model API's TPM limit and retry-loop.
  Fix: batch embeddings with a small delay between batches.
- **WAL disk exhaustion.** The `max_wal_size = 2GB` from Part 1 was
  fine until write volume tripled — WAL hit the disk limit on a slow
  archive night. Fix: raise it to 4GB and keep archiving faster than
  write volume.
- **A stuck reasoning job holding a worker forever.** Before timeouts
  were tuned, one pathological conversation could pin a worker for
  hours. `HONCHO_JOB_TIMEOUT=300` is not optional — it's the difference
  between a hiccup and an outage.
- **Redis memory eviction hitting the queue.** `allkeys-lru` (from
  Part 1) will happily evict queued jobs under pressure — for a queue
  you want `noeviction` plus headroom; losing a job silently is worse
  than failing loudly.

## 7. What shipped since Part 1

Status of Part 1's "What's Next" list:

- **Local embeddings — shipped.** Observations now use a local model
  on a spare GPU; only reasoning calls the cloud. Embedding cost went
  to zero and latency dropped. `text-embedding-3-small` is now the
  fallback.
- **Reasoning fallback — shipped.** When the primary model rate-limits,
  a cheaper fallback takes the job. Less eloquent, never down — for
  memory synthesis, reliable beats brilliant.
- **Selective memory — shipped.** Conversations tagged sensitive are
  stored but excluded from reasoning jobs. The PII question stopped
  being theoretical the first time I wanted to discuss credentials in a
  system that summarizes everything.
- **Multi-workspace — in progress.** One workspace per context
  (personal vs. work) with separate rate limits.

## The numbers that matter

| Metric | Part 1 | Now |
|--------|--------|-----|
| Conversations/month | ~500 | ~1,800 |
| DB size | 1.2GB | 4.8GB |
| Context retrieval | 120ms | ~10ms (HNSW + pooler) |
| Peak queue depth | n/a | 200+ → <10 |
| Reasoning p95 latency | 25s | <30s at peak |
| Connection errors | rare | 0 |

## The lesson

Honcho's architecture is sound; the failure modes are all in the
plumbing — the pool, the queue, the index, the backups. Tune those in
that order and growth stops being scary. The stack now runs for months
without manual intervention; the only scheduled maintenance is the
monthly restore drill.

*Subscriber-only, because this is the exact playbook — pooler configs,
index DDL, backup schedules, and the failure log — that took six months
and two incidents to assemble. The public series covers the "what"; this
is the "how, with scars attached".*
