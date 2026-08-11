---
title: "Meilisearch on Docker: Blazing Fast Full-Text Search for Your Blog"
date: "2026-08-06"
excerpt: "Run your own typo-tolerant full-text search engine in five minutes: Meilisearch on Docker, index creation, document sync, and reverse-proxying it behind nginx with TLS."
tags: ["self-hosting", "docker", "search", "meilisearch"]
---

Somewhere around the fiftieth blog post, scrolling stops working as a
navigation strategy. I kept typing titles into my own head and then
manually digging through folders to find them. The fix was a real
search engine — not grep, not a database `LIKE` query, but an actual
full-text engine that tolerates typos and answers in milliseconds.

That engine is **Meilisearch**, and running it on Docker takes about
five minutes. This is the exact path I took, with every command.

<figure>
  <img src="/images/meilisearch-on-docker-diagram.png" alt="Meilisearch on Docker: Blazing Fast Full-Text Search for Your Blog architecture diagram" width="1200" height="600" loading="lazy" />
  <figcaption class="font-mono text-xs text-dim mt-2 text-center">Meilisearch on Docker: Blazing Fast Full-Text Search for Your Blog system diagram</figcaption>
</figure>
## Why Meilisearch?

Meilisearch is an open-source search engine written in Rust. It is the
search equivalent of a sports car: you point it at documents, and it
returns ranked, typo-tolerant results in single-digit milliseconds.

The three features that sold me:

1. **Typo tolerance out of the box.** Searching `nginx reverce proxy`
   still finds "nginx reverse proxy". No configuration, no fuzzy-match
   tuning — it just works.
2. **Instant ranking.** Prefix search means results appear as you type,
   which is the difference between a search *box* and a search *engine*.
3. **Docker-native.** A single container, one volume, one env var, and
   it's production-ready.

It also respects a nice principle for a self-hoster: no telemetry
phoning home, no account required, no "cloud tier" nagging. The
community edition is genuinely free and genuinely complete.

## Step 1 — Run it with Docker

First, generate a master key. This is the only credential Meilisearch
needs, and it gates the admin API:

```bash
openssl rand -hex 32
# example output: 3f2a9c1d8e4b7a6f0c5d9e2b8a4f6c1d7e3b9a2f4c6d8e0b1a3f5c7d9e2b4a6c
```

Now a minimal `docker-compose.yml`:

```yaml
services:
  meilisearch:
    image: getmeili/meilisearch:v1.12
    container_name: meilisearch
    restart: unless-stopped
    user: "1000:1000"
    environment:
      - MEILI_MASTER_KEY=3f2a9c1d8e4b7a6f0c5d9e2b8a4f6c1d7e3b9a2f4c6d8e0b1a3f5c7d9e2b4a6c
      - MEILI_ENV=production
      - MEILI_NO_ANALYTICS=true
    volumes:
      - meili-data:/meili_data
    ports:
      - "7700:7700"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  meili-data:
```

Two env vars worth understanding:

- `MEILI_ENV=production` — in production mode Meilisearch refuses to
  start without a master key, disables the dev-mode UI, and turns on
  the dump/backup endpoints.
- `MEILI_NO_ANALYTICS=true` — Meilisearch's opt-out for its anonymous
  usage analytics. Set it, it costs nothing.

`user: "1000:1000"` runs the container as a non-root user (the UID your
user probably already has), which is the single cheapest security win
in self-hosting.

Bring it up:

```bash
docker compose up -d
curl http://localhost:7700/health
# {"status":"available"}
```

That's the whole install. The engine is running.

## Step 2 — Create an index and add documents

Meilisearch is an API-first product: everything is a REST call, and the
data format is JSON. Create an index and add three documents in one go:

```bash
curl -X POST "http://localhost:7700/indexes/posts/documents" \
  -H "Authorization: Bearer YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"id": 1, "title": "Nginx Reverse Proxy: From Zero to Production",
     "content": "Set up a reverse proxy with TLS termination...",
     "tags": ["nginx", "linux"]},
    {"id": 2, "title": "Docker Networking 101",
     "content": "How containers talk to each other across services...",
     "tags": ["docker", "networking"]},
    {"id": 3, "title": "Hardening Ubuntu Servers",
     "content": "UFW, fail2ban, and locked-down SSH...",
     "tags": ["security", "ubuntu"]}
  ]'
```

Now search it:

```bash
curl -s -X POST "http://localhost:7700/indexes/posts/search" \
  -H "Authorization: Bearer YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "docker network"}'
```

The response is a ranked hit list. Try the typo test — search
`nginx reverce proxy` and watch it still return document 1. The engine
does this by default, with zero configuration.

## Step 3 — Configure relevance properly

Default Meilisearch treats every field as searchable text. For a blog
you want titles to outweigh bodies:

```bash
curl -X PUT "http://localhost:7700/indexes/posts/settings" \
  -H "Authorization: Bearer YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchableAttributes": ["title", "tags", "content"],
    "filterableAttributes": ["tags"],
    "sortableAttributes": ["date"]
  }'
```

- `searchableAttributes` — field priority. A match in `title` outranks
  a match in `content`.
- `filterableAttributes` — lets you do `filter: tags = docker`, which
  becomes a nice "search within a tag" UI.
- `sortableAttributes` — sort results by date instead of relevance.

And synonyms, for the queries people actually type:

```bash
curl -X PATCH "http://localhost:7700/indexes/posts/settings/synonyms" \
  -H "Authorization: Bearer YOUR_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"docker": ["containers", "container"], "nginx": ["reverse proxy"]}'
```

## Step 4 — Sync a blog automatically

The elegant part: a blog already has structured metadata in every post's
frontmatter. A tiny sync script turns that into a Meilisearch
"add or update" call. Mine runs on every deploy, as a Node one-liner:

```js
// scripts/sync-search.mjs
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MEILI = "http://localhost:7700";
const KEY = process.env.MEILI_MASTER_KEY;
const POSTS_DIR = "./content/posts";

const posts = await Promise.all(
  (await readdir(POSTS_DIR))
    .filter((f) => f.endsWith(".md"))
    .map(async (f) => {
      const raw = await readFile(path.join(POSTS_DIR, f), "utf8");
      const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      const meta = Object.fromEntries(
        fm.split("\n").map((l) => l.match(/^(\w+):\s*"?([^"]*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]])
      );
      return {
        id: f.replace(/\.md$/, ""),
        title: meta.title,
        excerpt: meta.excerpt,
        tags: (meta.tags ?? "[]").replace(/[\[\]"]/g, "").split(",").map((t) => t.trim()).filter(Boolean),
        date: meta.date,
      };
    })
);

const res = await fetch(`${MEILI}/indexes/posts/documents`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(posts),
});
console.log(`Indexed ${posts.length} posts → ${res.status}`);
```

Run it after every deploy and the search index never goes stale.

## Step 5 — Put it behind nginx with TLS

Exposing port 7700 to the world is ugly and unencrypted. Put nginx in
front, exactly like you would for any other app. If Meilisearch lives
on a separate machine from your public-facing nginx, use its hostname
in the upstream — never expose the raw port to the internet:

```nginx
server {
    listen 443 ssl;
    server_name search.YOUR_DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/search.YOUR_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/search.YOUR_DOMAIN/privkey.pem;

    location / {
        proxy_pass http://YOUR_SERVER:7700;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# force HTTPS
server {
    listen 80;
    server_name search.YOUR_DOMAIN;
    return 301 https://$host$request_uri;
}
```

Issue the certificate with `certbot --nginx -d search.YOUR_DOMAIN`
before enabling this block, then reload nginx. Your frontend JavaScript
can now call `https://search.YOUR_DOMAIN/indexes/posts/search` over TLS.
I proxy a search subdomain the same way, and the site's search box is
just a few lines of `fetch` against it.

## Resource usage and monitoring

Meilisearch is RAM-hungry — it keeps indexes in memory for speed. As a
rule of thumb, budget **10× your dataset size** in RAM. My post index
(about 40 small documents) sits around 60MB; a 100,000-document
catalog would want 2–4GB. Watch it with:

```bash
docker stats meilisearch --no-stream
curl -s "http://localhost:7700/stats" -H "Authorization: Bearer YOUR_MASTER_KEY"
# {"databaseSize": 2097152, "lastUpdate": "...", "indexes": {...}}
```

If memory ever becomes a problem, there are two levers: `MEILI_MAX_INDEXING_MEMORY`
caps indexing-time memory, and the `search` (read-only) vs `admin` key
split lets you run a dedicated replica for query traffic. At blog scale
you will never need either — but it's good to know they exist.

## When NOT to use it

Honesty section. If your site has fewer than a few hundred documents
and no typo problem, a static search page built from the same frontmatter
is simpler and has zero moving parts. Meilisearch pays for itself the
moment you have (a) lots of documents, (b) a user who types badly, or
(c) a need for faceted filtering — that's when a hand-rolled solution
starts being a second job.

## Wrap-up

The whole thing — container, index, sync script, nginx — is about a
hundred lines and one volume. In exchange you get instant, typo-tolerant
search on your own hardware, with no third-party analytics and no
per-query bills. If you run any content-heavy service, this is one of
the highest happiness-per-minute self-hosting projects there is.

You can see it live in the search box on this very site. Next time
someone asks "how do I find that post about nginx?" — the answer is
three keystrokes, and it corrects their spelling while it's at it.
