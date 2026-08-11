---
title: "Subscriber-Only: Honcho Deep Dive — Deployment, Tuning & Hermes Integration"
date: "2026-08-04"
excerpt: "The complete Honcho deployment guide: Docker Compose, Postgres tuning, dialectic engine config, Honcho-to-Hermes wiring, health checks, and real-world performance numbers."
tags: ["honcho", "hermes-agent", "ai", "self-hosting", "memory", "subscriber-only"]
premium: true
---

In [part 4](/blog/what-is-honcho) I covered what Honcho is and why it matters. This post is the **operator's manual** — the exact config I run in production, the numbers behind it, and the integration points that make it work with Hermes Agent.

---

## The Deployment Stack

Honcho runs on a Docker server alongside the mail server and the Technography Postgres. It's a single Docker Compose stack:

```yaml
# docker-compose.honcho.yml
version: "3.8"

services:
  honcho:
    image: ghcr.io/plastic-labs/honcho:latest
    container_name: honcho
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      # Core
      - HONCHO_API_KEY=honcho-dev-key
      - HONCHO_DATABASE_URL=postgresql://honcho:changeme@db:5432/honcho
      - HONCHO_REDIS_URL=redis://redis:6379/0
      
      # Dialectic engine
      - HONCHO_REASONING_MODEL=gpt-4o-mini
      - HONCHO_REASONING_MAX_TOKENS=4000
      - HONCHO_REASONING_TEMPERATURE=0.1
      - HONCHO_OBSERVATION_MODEL=gpt-4o-mini
      - HONCHO_EMBEDDING_MODEL=text-embedding-3-small
      
      # Performance
      - HONCHO_WORKER_COUNT=2
      - HONCHO_MAX_CONCURRENT_JOBS=4
      - HONCHO_JOB_TIMEOUT=300
      
      # Rate limits (per workspace)
      - HONCHO_RATE_LIMIT_RPM=120
      - HONCHO_RATE_LIMIT_TPM=200000
      
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

  db:
    image: postgres:16-alpine
    container_name: honcho-db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=honcho
      - POSTGRES_PASSWORD=changeme
      - POSTGRES_DB=honcho
    volumes:
      - honcho-db-data:/var/lib/postgresql/data
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c work_mem=16MB
      -c maintenance_work_mem=128MB
      -c max_connections=100
      -c random_page_cost=1.1
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U honcho -d honcho"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: honcho-redis
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - honcho-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  honcho-db-data:
  honcho-redis-data:
```

**Resource allocation on the Docker server (7.7GB total):**
- Honcho API: ~400MB RAM, 0.5 vCPU
- Postgres: ~500MB RAM (shared_buffers 256MB + cache)
- Redis: 256MB RAM max
- **Total: ~1.2GB** — well within the 7.7GB headroom.

---

## Postgres Tuning for Honcho

Honcho writes **a lot** — every conversation turn triggers observation extraction, reasoning jobs, and embedding writes. The default Postgres config chokes under this. Key settings:

```sql
-- Run inside honcho-db container after init
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET random_page_cost = 1.1;  -- SSD
ALTER SYSTEM SET synchronous_commit = 'off';  -- Honcho can tolerate slight data loss on crash
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET max_wal_size = '2GB';
ALTER SYSTEM SET min_wal_size = '512MB';
SELECT pg_reload_conf();
```

**Why `synchronous_commit = off`?** Honcho's reasoning jobs are idempotent and retried. Losing the last few milliseconds of writes on a crash is acceptable for the throughput gain (~30% more writes/sec).

---

## Dialectic Engine Configuration

The reasoning engine is Honcho's differentiator. These settings balance quality vs. cost:

| Setting | Value | Rationale |
|---------|-------|-----------|
| `HONCHO_REASONING_MODEL` | `gpt-4o-mini` | Best cost/quality for reasoning; 128K context |
| `HONCHO_REASONING_MAX_TOKENS` | 4000 | Covers multi-turn synthesis |
| `HONCHO_REASONING_TEMPERATURE` | 0.1 | Deterministic conclusions |
| `HONCHO_OBSERVATION_MODEL` | `gpt-4o-mini` | Fast fact extraction |
| `HONCHO_EMBEDDING_MODEL` | `text-embedding-3-small` | 1536-dim, cheap, good enough |
| `HONCHO_WORKER_COUNT` | 2 | Matches 2 vCPU allocation |
| `HONCHO_MAX_CONCURRENT_JOBS` | 4 | 2x workers for queue depth |

**Monthly cost estimate** (at current usage ~500 conversations/mo):
- Reasoning: ~$0.15/1K tokens × 20K tokens/convo = ~$150/mo
- Embeddings: ~$0.02/1M tokens × 5M tokens = ~$0.10/mo
- **Total: ~$150/mo** via OmniRoute (which routes to cheapest provider)

---

## Wiring Honcho to Hermes Agent

Hermes talks to Honcho via the **memory provider** interface. In `~/.hermes/config.yaml`:

```yaml
memory:
  provider: "honcho"
  honcho:
    base_url: "http://<HONCHO_HOST>:8000"
    api_key: "honcho-dev-key"
    workspace: "deepukhadgi"
    timeout: 10000
    
    # What to store
    store_user_messages: true
    store_assistant_messages: true
    store_tool_calls: true
    store_tool_results: true
    
    # Retrieval
    max_context_tokens: 8000
    include_card: true
    include_representation: true
    include_conclusions: true
    include_recent_messages: 20
    
    # Behavior
    auto_conclude: true
    conclude_interval_turns: 10
```

**How the flow works:**

```
User message → Hermes Agent
    │
    ├─► Honcho: store_turn() — persists raw messages
    │
    ├─► Honcho (async): observation job extracts facts
    │
    ├─► Honcho (async): reasoning job synthesizes conclusions
    │
    └─► Next turn: Hermes calls Honcho context API
         ├─► Returns: card (10 facts) + representation (profile) + conclusions + recent
         └─► Injected into system prompt automatically
```

---

## Health Checks & Monitoring

**API health endpoint:**
```bash
curl http://<HONCHO_HOST>:8000/health
# {"status":"healthy","database":"connected","redis":"connected","version":"0.1.0"}
```

**Key metrics to watch:**
```bash
# Active reasoning jobs
curl -H "Authorization: Bearer honcho-dev-key" \
  http://<HONCHO_HOST>:8000/v3/workspaces/deepukhadgi/jobs/stats

# Database size
docker exec honcho-db psql -U honcho -d honcho -c "
  SELECT pg_size_pretty(pg_database_size('honcho')) as db_size;
"

# Conversation count
docker exec honcho-db psql -U honcho -d honcho -c "
  SELECT count(*) FROM conversations WHERE workspace_id = 'deepukhadgi';
"
```

**Alerting rules (I use a simple cron + Telegram):**
- Honcho API down > 2 min → alert
- Reasoning job queue > 50 → alert (means workers stuck)
- DB size > 5GB → alert (cleanup needed)
- Redis memory > 80% → alert

---

## Real-World Performance Numbers

| Metric | Value | Notes |
|--------|-------|-------|
| Avg context retrieval | 120ms | Card + representation + conclusions |
| Observation job latency | 2-5s | Async, doesn't block chat |
| Reasoning job latency | 8-25s | Depends on conversation length |
| Context token size | 2-8K tokens | Grows with relationship depth |
| Conclusions generated | ~15/month | Auto-conclude every 10 turns |
| DB size after 3 months | 1.2GB | ~400MB/month growth |
| Monthly API cost | ~$150 | Via OmniRoute free-tier routing |

---

## Common Operations

**Reset a workspace (nuclear option):**
```bash
docker exec honcho-db psql -U honcho -d honcho -c "
  DELETE FROM conversations WHERE workspace_id = 'deepukhadgi';
  DELETE FROM observations WHERE workspace_id = 'deepukhadgi';
  DELETE FROM conclusions WHERE workspace_id = 'deepukhadgi';
  DELETE FROM representations WHERE workspace_id = 'deepukhadgi';
  DELETE FROM cards WHERE workspace_id = 'deepukhadgi';
"
```

**Force a reasoning run:**
```bash
curl -X POST -H "Authorization: Bearer honcho-dev-key" \
  -H "Content-Type: application/json" \
  http://<HONCHO_HOST>:8000/v3/workspaces/deepukhadgi/reasoning/trigger \
  -d '{"reasoning_level": "high"}'
```

**Export profile for backup:**
```bash
curl -H "Authorization: Bearer honcho-dev-key" \
  http://<HONCHO_HOST>:8000/v3/workspaces/deepukhadgi/peers/deepu/context \
  > honcho-profile-backup.json
```

---

## What's Next

The stack is stable. Future improvements I'm tracking:

1. **Local embeddings** — swap `text-embedding-3-small` for `nomic-embed-text` on local GPU (zero cost, privacy)
2. **Reasoning model fallback** — route to local Llama-3.1-8B when cloud APIs rate-limit
3. **Selective memory** — tag sensitive conversations as "do not reason" (PII protection)
4. **Multi-workspace** — separate workspaces for personal vs. work contexts

---

*This post is subscriber-only because it contains exact production configs, cost numbers, and operational procedures that took months to refine. The public series covers the "what" and "why"; this covers the "how" with real numbers.*

---

**Previous in series:** [Part 1: Hermes + OmniRoute](/blog/omniroute-hermes-agent) → [Part 2: Hermes Agent Deep Dive](/blog/what-is-hermes-agent) → [Part 3: OmniRoute Gateway](/blog/what-is-omniroute) → [Part 4: What is Honcho?](/blog/what-is-honcho) → **This post (Part 5: Honcho Deep Dive)**