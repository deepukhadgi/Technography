---
title: "What is Honcho? AI-native memory for your self-hosted agent"
date: "2026-08-02"
excerpt: "Your agent remembers conversations but doesn't *understand* you. Honcho fixes that — a self-hosted memory backend that builds a model of who you are, how you work, and what you care about. Here's what it is, how to deploy it, and how to wire it to Hermes Agent."
tags: ["honcho", "hermes-agent", "ai", "self-hosting", "memory"]
---

Every AI agent has a memory problem. It can store notes, persist facts, even
search past conversations — but none of that is *understanding*. Your agent
knows what you told it last Tuesday. It doesn't know that you prefer concise
responses, that you always ask before touching production, or that when you
say "fix it" you mean "fix it now and show me the proof." That kind of
context lives in the gaps between messages, and no amount of keyword search
fills it.

Honcho is a different kind of memory. This is part 4 of my self-hosted AI
series — [part 1 wired Hermes Agent to OmniRoute](/blog/omniroute-hermes-agent),
[part 2 went deep on Hermes itself](/blog/what-is-hermes-agent), and
[part 3 covered the OmniRoute gateway](/blog/what-is-omniroute). Here I'm
adding the piece that makes the whole stack actually *know* me.

## What it is

Honcho is an open-source, AI-native memory backend built by Plastic Labs.
It's not a database, not a vector store, not a key-value cache — it's a
**dialectic reasoning engine** that sits alongside your agent and builds a
persistent, evolving model of the user.

Where traditional memory stores raw facts ("user prefers Telegram"),
Honcho reasons about those facts after each conversation turn and derives
insights ("user is action-oriented — prefers execute-first-verify-later
over discuss-first-decide-later"). Those insights accumulate into a profile
that deepens over time, capturing patterns the user never explicitly stated.

The architecture is deceptively simple:

- **Peer cards** — curated facts about who you are (role, preferences,
  communication style)
- **Conclusions** — derived insights from the dialectic engine that go
  beyond what you explicitly said
- **Session summaries** — automatic compression of each conversation into
  reusable context
- **Representation** — a synthesized model of you that updates continuously

All of this lives on your own server. No cloud dependency, no data leaving
your network.

## Why it matters for self-hosted agents

Most agent memory systems have a ceiling: you store notes in a file, and
eventually the file is too big to inject into every prompt. Honcho sidesteps
this by maintaining a **server-side model** that the agent queries on demand
or receives as injected context — capped by a token budget you control.

The practical difference is night and day. Without Honcho, my agent
accumulates a memory file that fills up, gets aggressively pruned, and loses
context as sessions pile up. With Honcho, the agent has a rich, structured
understanding of me that grows more useful over time, without blowing up the
context window.

Honcho also supports multiple peers — so if you run separate agent instances
(a coding assistant, a personal assistant), each one gets its own isolated
profile. No cross-contamination between your work context and your personal
context.

## Self-hosting it

Honcho ships as a Docker Compose stack with four containers:

- **api** — the main Honcho server (FastAPI)
- **deriver** — background worker that runs dialectic reasoning and
  consolidation
- **database** — PostgreSQL with pgvector for vector storage
- **redis** — cache layer

The whole stack runs comfortably on a small VM with 2 GB of RAM. Here's
the setup:

```bash
# Clone the repo
git clone --depth 1 https://github.com/plastic-labs/honcho.git /opt/honcho
cd /opt/honcho

# Copy the example files
cp docker-compose.yml.example docker-compose.yml
cp .env.template .env
```

Edit `docker-compose.yml` to bind the API to your LAN instead of localhost
(needed if your agent runs on a different machine):

```yaml
ports:
  - "0.0.0.0:8000:8000"   # was 127.0.0.1:8000:8000
```

Now edit `.env` with the essentials:

```bash
# Database (uses Docker internal networking)
DB_CONNECTION_URI=postgresql+psycopg://postgres:postgres@database:5432/postgres

# Cache
CACHE_URL=redis://redis:6379/0?suppress=true
CACHE_ENABLED=true

# Auth — disable for local LAN (no JWT needed)
AUTH_USE_AUTH=false

# LLM provider — point at your gateway
LLM_OPENAI_API_KEY=<your-key-or-dummy>

# Route all LLM calls through your AI gateway
MODEL_CONFIG__TRANSPORT=openai
MODEL_CONFIG__MODEL=auto/best-fast
MODEL_CONFIG__OVERRIDES__BASE_URL=http://<your-gateway>:20128/v1
```

You'll also need to configure the **deriver**, **summary**, **dialectic**,
and **dream** features with the same gateway overrides — each one has its
own `MODEL_CONFIG__TRANSPORT`, `MODEL_CONFIG__MODEL`, and
`MODEL_CONFIG__OVERRIDES__BASE_URL` env vars. The pattern is identical for
each; just point them at the same gateway.

Then build and start:

```bash
docker compose up -d --build
```

Verify it's alive:

```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

The Swagger UI at `http://localhost:8000/docs` gives you a visual interface
to explore every API endpoint — useful for poking around and confirming
things work.

## The gotchas

I hit every one of these deploying Honcho. Save yourself the debugging:

**Embedding model compatibility.** Honcho's embedding client sends a
`dimensions` parameter to the embedding API by default. Most providers
(Mistral, NVIDIA) reject this with an HTTP 422. The fix is a single env var:

```bash
EMBEDDING_MODEL_CONFIG__DIMENSIONS_MODE=never
```

Without this, your conclusion writes and semantic search will silently fail.

**Vector dimensions must match.** If the database was initialized with one
dimension count (1536 is the default) and you switch to a different
embedding model (1024 for `mistral/mistral-embed`), you need to reconfigure
the pgvector columns:

```bash
# Recreate the API container first (so new env is live)
docker compose up -d --no-deps api

# Then run the migration
docker exec honcho-api-1 python scripts/configure_embeddings.py --yes
```

**`EMBED_MESSAGES=false` doesn't fully disable embeddings.** The conclusion
write path still triggers embedding calls even with this set. Fix the
embedding config properly rather than trying to disable it entirely.

**The env file can silently not load.** Docker Compose's `env_file` in the
example uses `required: false` — if your `.env` is missing or misnamed, the
app starts with defaults and fails later on LLM calls. Always verify:

```bash
docker exec honcho-api-1 env | grep MODEL_CONFIG
```

## Connecting it to Hermes Agent

Hermes Agent has an official Honcho integration — a memory provider plugin
that handles everything: session management, context injection, dialectic
reasoning, and the Honcho tool suite.

On the Hermes side, you need three things:

**1. Set the memory provider:**

```bash
hermes config set memory.provider honcho
```

**2. Create `~/.hermes/honcho.json`:**

This is where most people get stuck. The `baseUrl` field **must be at the
root level** of the JSON, not nested inside a host block:

```json
{
  "baseUrl": "http://<your-honcho-server>:8000",
  "apiKey": "<your-honcho-api-key>",
  "workspace": "<workspace-id>",
  "hosts": {
    "default": {
      "peerName": "<your-name>",
      "aiPeer": "<agent-name>",
      "recallMode": "hybrid",
      "dialecticCadence": 3,
      "dialecticDepth": 1,
      "dialecticReasoningLevel": "low",
      "sessionStrategy": "per-session"
    }
  }
}
```

The SDK reads `baseUrl` from `raw.get("baseUrl")` — the root of the JSON.
If you put it inside `hosts.default`, it silently falls back to Honcho
Cloud and you get an "Invalid API key" error with no explanation.

**3. Add the API key to `.env`:**

```bash
echo 'HONCHO_API_KEY=<your-key>' >> ~/.hermes/.env
```

**4. Restart the gateway:**

```bash
hermes gateway restart
```

This step **cannot be done from inside the gateway process** — the restart
kills the shell before the command completes. Run it from a separate
terminal or SSH session.

Verify everything is wired:

```bash
hermes memory status
# → Provider: honcho
# → Status: available ✓
```

## The tools you get

Once connected, Hermes gets five new Honcho tools:

| Tool | What it does | Cost |
|------|-------------|------|
| `honcho_profile` | Read or update the peer card | Free |
| `honcho_conclude` | Write persistent derived facts | Free |
| `honcho_search` | Semantic search over past conversations | Free |
| `honcho_context` | Full context snapshot (summary + profile) | Free |
| `honcho_reasoning` | Ask Honcho's dialectic engine a question | LLM call |

The dialectic engine runs automatically every few turns (configurable via
`dialecticCadence` in `honcho.json`), building a deeper understanding of
you without being asked. The `honcho_reasoning` tool lets you explicitly
query that understanding when you need it.

## The cost

The Honcho server itself is free — MIT licensed, self-hosted, no usage fees.
The only cost is the LLM calls for dialectic reasoning (configurable via
`dialecticCadence` and `dialecticDepth`). With conservative settings
(dialectic every 3 turns, depth 1, low reasoning level), the token cost is
negligible — a few thousand tokens per session.

## The result

What I noticed immediately: the agent stopped asking me things it should
already know. It stopped suggesting approaches I've rejected before. It
started matching my communication style — concise, direct, action-oriented —
without being told each time. The memory file that was 97% full and getting
aggressively pruned is now a supplement, not the whole story.

The understanding deepens with every conversation. A week in, Honcho had
already picked up on patterns I hadn't explicitly stated: that I prefer
Telegram notifications, that I always want verification after changes, that
I'm protective of one specific server more than the others. None of that
came from me saying "remember this." It came from Honcho watching how I
actually work.

*This is part 4 of my self-hosted AI series. Part 1 shows the Hermes + OmniRoute setup: [Running Hermes Agent with OmniRoute](/blog/omniroute-hermes-agent). Part 2 explains the agent itself: [What is Hermes Agent?](/blog/what-is-hermes-agent). Part 3 breaks down the gateway: [What is OmniRoute?](/blog/what-is-omniroute).*
