---
title: "Honcho Memory Architecture: From Conversations to Actionable Insights"
date: "2026-08-22"
excerpt: "Honcho is not a vector store with a chat wrapper. It is a three-layer memory engine — conversation logs, semantic extraction, and an action graph — that turns raw dialogue into structured knowledge your agents can actually use."
tags: ["honcho", "memory", "architecture", "ai", "subscriber-only"]
premium: true
---

I have spent the last year living with an AI assistant that does not just answer questions — it remembers what I told it three weeks ago, connects it to the bug I filed yesterday, and surfaces the right context when I open a new task. The engine behind that is **Honcho**, and its architecture is the reason it works.

Most "memory" layers for LLMs are a thin wrapper around pgvector or Chroma: embed the last N messages, stuff them into the context window, hope for the best. Honcho is different. It separates **what happened** from **what matters** from **what to do about it**. This post is the architectural deep dive I wish existed when I started.

## Three layers, not one

Honcho stores memory in three distinct tables, each with a different schema, different TTL, and different query path.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Conversation Log (append-only, full fidelity)     │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Semantic Facts (extracted, deduplicated, typed)   │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Action Graph (nodes = tasks, edges = dependencies)│
└─────────────────────────────────────────────────────────────┘
```

When you say "I'm setting up Proxmox on <YOUR_HOST> with root/password", Layer 1 stores the raw exchange verbatim. Layer 2 extracts `fact: Proxmox host = <YOUR_HOST>, credentials stored in secret manager`. Layer 3 creates a node `task: configure Proxmox` with edges to `task: harden SSH` and `task: deploy VM templates`.

Agents query Layer 3 for "what should I do next", Layer 2 for "what do I know about X", and Layer 1 only when they need the exact wording of a past decision.

## Layer 1: the conversation log — write path

Schema (PostgreSQL, append-only):

```sql
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL,
    role            TEXT NOT NULL,          -- 'user' | 'assistant' | 'tool'
    content         TEXT NOT NULL,
    token_count     INT NOT NULL,
    metadata        JSONB DEFAULT '{}',     -- model, temperature, tool_calls, etc.
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON conversations (session_id, created_at);
```

No embeddings here. No summarization. This is the immutable audit trail. TTL: **forever** (or until explicit user deletion). It is the source of truth for everything downstream.

The write path is synchronous but cheap: a single `INSERT` per message. At ~2,000 messages/day, that is ~60M rows/year — well within Postgres range. Partition by `session_id` if you hit 100M+.

## Layer 2: semantic facts — the extraction pipeline

This is where the intelligence lives. Every N messages (configurable, default 10) or on explicit `flush`, a background worker runs the **Fact Extractor**:

```python
# Pseudo-code — real implementation uses structured output + few-shot
async def extract_facts(messages: List[Message]) -> List[Fact]:
    prompt = f"""
    Extract atomic, verifiable facts from this conversation.
    Output JSON: {{"facts": [{{"subject": "...", "predicate": "...", "object": "...",
                                 "confidence": 0.0-1.0, "source_msg_ids": [...]}}]}}
    Only emit facts that are:
    - Specific (no "user likes Linux")
    - Actionable (useful for future tasks)
    - Not already known (dedup against existing facts)
    """
    return await structured_llm(prompt, schema=FactSchema)
```

A **Fact** is a typed triple with provenance:

```python
@dataclass
class Fact:
    subject: str           # "Proxmox host"
    predicate: str         # "has_ip"
    object: str            # "<YOUR_HOST>"
    confidence: float      # 0.92
    source_msg_ids: List[UUID]
    extracted_at: datetime
    supersedes: Optional[UUID] = None  # for updates
```

Deduplication happens at write time: upsert on `(subject, predicate)` with `confidence` as the tiebreaker. If a new extraction says "Proxmox host has_ip <YOUR_OTHER_HOST>" with 0.6 confidence but we already have 0.92 for `<YOUR_HOST>`, the old one wins. This prevents hallucinated corrections from polluting the KB.

Schema:

```sql
CREATE TABLE facts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject         TEXT NOT NULL,
    predicate       TEXT NOT NULL,
    object          TEXT NOT NULL,
    confidence      REAL NOT NULL,
    source_msg_ids  UUID[] NOT NULL,
    supersedes_id   UUID REFERENCES facts(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (subject, predicate)  -- one canonical fact per relation
);
CREATE INDEX ON facts (subject);
CREATE INDEX ON facts (predicate);
```

TTL: **never expires**. Facts are corrected, not deleted. A `supersedes_id` chain gives you full history.

## Layer 3: the action graph — from facts to tasks

Facts are static. The **Action Graph** makes them executable. Every fact that implies work spawns or updates a **TaskNode**:

```python
@dataclass
class TaskNode:
    id: UUID
    title: str                    # "Harden Proxmox SSH"
    status: str                   # "pending" | "in_progress" | "done" | "blocked"
    source_fact_ids: List[UUID]   # which facts created/updated this
    depends_on: List[UUID]        # edges to other TaskNodes
    assignee: Optional[str]       # agent name or "human"
    created_at: datetime
    updated_at: datetime
```

Edges are explicit dependencies, not similarity scores. "Configure Proxmox" → "Harden SSH" is a hard edge because the second cannot start until the first provides the root credentials. The graph is a DAG (cycles rejected at insert).

Schema:

```sql
CREATE TABLE task_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    source_fact_ids UUID[] NOT NULL,
    assignee        TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE task_edges (
    from_id UUID REFERENCES task_nodes(id),
    to_id   UUID REFERENCES task_nodes(id),
    type    TEXT NOT NULL DEFAULT 'depends_on',  -- 'depends_on' | 'blocks' | 'relates_to'
    PRIMARY KEY (from_id, to_id)
);
```

The **Scheduler** (a tiny cron job) traverses the DAG every minute, finds nodes whose `depends_on` are all `done`, and enqueues them to the agent queue. This is how "I need to deploy the blog" automatically becomes a sequence of: build → test → deploy → verify → index search, without me listing steps.

## Query patterns agents actually use

The three layers exist because agents ask three different questions:

| Question | Layer | Query |
|----------|-------|-------|
| "What did we decide about X?" | 1 (conversations) | Full-text search on `content` + `session_id` filter |
| "What do I know about X?" | 2 (facts) | `SELECT * FROM facts WHERE subject ILIKE '%X%'` |
| "What should I do next?" | 3 (action graph) | Recursive CTE for ready-to-run tasks |

Crucially, **agents never vector-search Layer 1**. They only vector-search Layer 2 (facts) when the subject is fuzzy. The embedding is on `(subject || ' ' || predicate || ' ' || object)` — the fact itself, not the raw chat. This keeps the embedding space clean and the results actionable.

## The feedback loop: corrections flow upstream

When an agent acts on a fact and discovers it is wrong (e.g., tries to SSH to `<YOUR_HOST>` and gets connection refused), it emits a **CorrectionEvent**:

```python
@dataclass
class CorrectionEvent:
    original_fact_id: UUID
    corrected_fact: Fact
    evidence: str           # "SSH timeout after 30s"
    confidence: float       # usually 1.0 — we observed it
```

This creates a new fact with `supersedes_id` pointing to the old one, and marks any dependent `TaskNodes` as `blocked` until re-evaluated. The graph self-heals.

## What this buys you

1. **No context window bloat** — agents pull exactly the 3-5 facts they need, not the last 50 messages.
2. **Auditability** — every fact has a `source_msg_ids` chain back to the exact user utterance.
3. **Multi-agent coherence** — Agent A extracts facts, Agent B schedules tasks, Agent C executes. They share Layer 2 and 3, not a chat history.
4. **Durable learning** — a fact extracted in January is still queryable in December, even across model upgrades.

## What it does not do (yet)

- **Cross-session fact merging** — facts are currently scoped to a `session_id`. A global fact KB is on the roadmap.
- **Temporal reasoning** — "the IP changed last week" requires a time-series fact store, not a single `object` value.
- **Conflict resolution UI** — when two extractions disagree on a fact, the higher confidence wins silently. A human-in-the-loop review queue would be better.

## Try it locally

Honcho runs as a standalone service (FastAPI + Postgres + Redis). The repo is private for now, but the schema and extraction prompts are portable. If you want a minimal version:

1. Spin up Postgres with the three tables above.
2. Add a background job that runs the extractor every N messages.
3. Expose `/facts?subject=X` and `/tasks/ready` endpoints.
4. Wire your agent to call those instead of stuffing history into the prompt.

The architecture is the product. The code is just the vehicle.

---

*This post is part of the Technography subscriber series. The automation that drafted, built, deployed, and indexed it runs on the stack described in [The Complete Technography Stack](/blog/the-complete-technography-stack).*