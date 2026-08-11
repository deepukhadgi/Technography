---
title: "The Complete Technography Stack: Every Tool, Every Config"
date: "2026-08-07"
excerpt: "The full bill of materials for this blog: every service, every config decision, every trade-off — from Cloudflare at the edge down to the Postgres container that stores your subscriber record."
tags: ["self-hosting", "stack", "infrastructure", "architecture", "subscriber-only"]
premium: true
---

People keep asking what actually runs this site. Not the "I blog on
Next.js" answer — the real one: every container, every reverse proxy,
every cron job, and the exact config that makes them cooperate. This
post is that bill of materials — the architecture I would hand anyone
who wants to replicate it on a single weekend.

## The one-paragraph overview

A Cloudflare edge fronts an nginx reverse proxy on a single Ubuntu VPS.
Behind that proxy sits a Next.js 16 app in standalone mode, a Postgres
database, and a Meilisearch instance. Around those live three
satellites: Umami for analytics, Listmonk for the newsletter, and a
mail server that only relays. Off to the side, an AI automation layer
drafts content and keeps a memory store. Everything except the edge is
self-hosted, and the total bill stays tiny.

## The edge: Cloudflare in front, nginx at the origin

Every request to deepukhadgi.com.np hits Cloudflare's proxy first. That
gives me DDoS scrubbing, a free CDN for static assets, and — most
importantly — the ability to hide the origin IP entirely.

The TLS story is worth spelling out because it confused me for years:
Cloudflare's edge certificate handles the browser side, while an
**Origin certificate** (issued by Cloudflare, valid for 15 years,
trusted only by Cloudflare's edge) handles the Cloudflare-to-origin
side. The nginx config sets the proxy mode to **Full (Strict)**, which
means Cloudflare refuses to connect unless my origin serves a valid
Origin certificate. End-to-end encryption with zero cost and zero
renewal pain — certbot is never even installed on the origin for the
public domain.

Behind Cloudflare, nginx is the only thing listening on ports 80/443.
Every other service binds to localhost or a private Docker network and
is reached only through named server blocks. The one rule I stick to:
**no service gets a public port unless nginx has a server block for
it.**

```nginx
# Default server block that rejects unknown Host headers
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    ssl_reject_handshake on;
    return 444;
}
```

That block alone kills scanner noise, IP-direct hits, and
host-header-injection attempts in one shot.

## The app: Next.js 16, standalone, force-dynamic

The blog itself is Next.js 16 with the App Router and TypeScript,
built with `output: "standalone"` so the production artifact is a
single self-contained folder I can ship anywhere. The build runs on my
laptop, the resulting `.next/standalone` tree is rsynced to the VPS,
and a systemd unit runs the bundled server:

```ini
[Unit]
Description=Technography blog
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/technography
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
EnvironmentFile=/etc/technography.env
```

No Docker for the app itself — a bare node process under systemd is
fewer moving parts, restarts faster, and its logs land in journald with
every other system service.

The interesting decision is that **every post page is
force-dynamic**. There is no static generation of articles, even though
the content is just markdown. Why? Because premium gating checks
subscription state on every request, and in Next.js 16 using `cookies()`
during static generation throws at build time. Rather than fighting
that, I made the trade deliberately: content renders from local
markdown in a few milliseconds, which is irrelevant next to the
benefit of never accidentally shipping a gated article into a static
prerender.

## Content: markdown in git, published by pipeline

Posts live as plain markdown files with YAML frontmatter:

```yaml
---
title: "Post title"
date: "2026-08-07"
excerpt: "One or two sentences."
tags: ["self-hosting", "docker"]
premium: true
---
```

The `premium: true` flag is the only thing that separates a public post
from a subscriber-only one. The whole content pipeline is:

1. Topic ideas live in a queue file with statuses
   (`pending → published`).
2. A scheduled AI agent drafts posts from that queue.
3. The draft is built, security-scanned, committed, and deployed.
4. A script re-indexes every post into Meilisearch so search is
   immediately current.
5. The newsletter tool picks up new posts automatically for the
   subscriber campaign.

Because everything is plain text in a git repo, history is free,
rollbacks are a `git revert` away, and the content is never trapped in
a database schema.

## Data: Postgres, Meilisearch

**Postgres** holds the non-content state: user accounts, password
hashes, session data, and subscriber records synced with the
newsletter tool. The instance is a Docker container on a private
network with a named volume — backups are nightly `pg_dump`s shipped
off-box, and restore is tested on a schedule, not on the day of a
disaster.

**Meilisearch** powers site search. It is a Rust full-text engine that
tolerates typos and returns results in single-digit milliseconds. The
index lives in one container with a volume and a master key. After
every deploy, a Node script reads all markdown posts, parses the
frontmatter, and replaces the entire `posts` index in one API call:

```js
const res = await fetch(`${MEILI_HOST}/indexes/posts/documents`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${MEILI_MASTER_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(documents),
});
```

A full reindex of a few hundred posts takes well under a second, and
because the whole index is rebuilt on every publish, there is no
incremental sync to maintain.

## The satellites: Umami, Listmonk, mail

- **Umami** is the analytics: a container, a Postgres database, a
  one-line script tag. It shows which posts people actually read
  without cross-site tracking, cookies for identity, or ad networks.
  The script is proxied through the site's own domain path, so no
  analytics domain leaks into public HTML and the CSP stays clean.
- **Listmonk** runs the newsletter: a Go binary and its own Postgres
  database for subscribers, templates, and campaigns. It sends through
  the mail relay, and double opt-in keeps the list clean.
- **Mail** is a plain Postfix instance that only relays: it accepts
  mail from local services, hands it to a transactional SMTP provider,
  and never accepts inbound mail from the internet. SPF, DKIM, and
  DMARC are set on the sending domain — one malformed TXT record is
  all it takes to land every newsletter in spam.

## The AI layer: drafting, memory, and a gateway

This blog is partly written by an autonomous agent, and the setup is
deliberately boring: an agent runtime on a schedule, a memory service
that stores conversation context across sessions, and an AI gateway
that routes requests to whichever model makes sense for the task —
cheap models for drafting, better ones for review, with a queue and
rate limits so nothing ever spikes a bill.

The rule that keeps this sane: **the agent drafts, but a human-shaped
approval gate exists before anything ships.** The pipeline builds and
smoke-tests drafts; a final review catches tone, facts, and typos. The
AI accelerates the loop; it does not own the publish button — and
every article is security-scanned before commit, because this repo is
public.

## Backups, monitoring, and the boring stuff

- **Nightly**: Postgres dumps (app + newsletter) shipped off-box, plus
  a full file backup of the deploy directory.
- **Continuous**: fail2ban on SSH, automatic security updates, UFW
  allowing only 80/443/SSH, SSH hardened to key-based auth with a
  limited user set.
- **Health**: an uptime check hits the homepage and an API endpoint
  every few minutes and alerts on failure — the goal is catching the
  site that is *quietly* broken, like a stale search index or a
  campaign stuck in the send queue.

## What it costs

The honest math, monthly: one VPS, one domain registration, and the
email provider's usage fee (pennies at blog scale). Everything else —
analytics, search, newsletter, CMS, SSL, CDN — is free self-hosted
software. Every byte of data is mine.

## Lessons I'd hand back in time

1. **Write the default-server reject block before anything else.** It
   is five lines and it removes an entire class of noise.
2. **Force-dynamic on premium routes is a feature, not a hack.** A
   static-gated post leaking is a privacy incident; a few extra
   milliseconds of render time is nothing.
3. **Reindex search on every deploy.** Stale search results are worse
   than no search — people trust the box, and it lied to them.
4. **Test restores, not just backups.** A backup you have never
   restored is a rumor.
5. **The AI drafts; the pipeline verifies; a human publishes.** Each
   layer catches what the previous one misses.

That is the whole stack: twelve moving parts, one VPS, zero vendor
lock-in, and a monthly bill I can recite from memory. If you are
building something similar, steal the configs that make sense and
question the rest — every choice above was made by breaking things
first.
