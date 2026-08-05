---
title: "Building a Self-Hosted Blog with AI-Powered Automation"
date: "2026-08-05"
excerpt: "The full behind-the-scenes of this blog — Next.js, nginx, Cloudflare, Postgres, and the AI agent that writes, deploys, and tracks every post. For subscribers."
tags: ["ai", "automation", "self-hosting", "nextjs", "blog", "subscriber-only"]
premium: true
---

The public posts show you how-to guides. This one shows you the machine:
the exact stack this blog runs on, and the AI agent that operates it end
to end. Every post you read here went through the same pipeline — an
agent wrote or revised it, deployed it, and verified it live — and I
never once SSH'd in by hand to ship it.

If you want to replicate this, every piece is named below, and every
piece is open source.

## The architecture

| piece         | choice                                   |
| ------------- | ---------------------------------------- |
| app           | Next.js 16, App Router, standalone build |
| reverse proxy | nginx                                    |
| TLS           | Cloudflare (proxy)                       |
| database      | Postgres on the Docker server            |
| AI gateway    | OmniRoute                                |
| agent         | Hermes Agent                             |
| memory        | Honcho                                   |
| newsletter    | Listmonk                                 |
| repo          | public GitHub                            |

The physical layout is a Proxmox host with two VMs doing real work: one
webserver VM running nginx and the app, and one Docker server (I call
it a separate Docker server) running everything else — Postgres, Listmonk, OmniRoute,
Honcho. One job per VM, so when something breaks you know exactly which
box to look at ([my home lab layout](/blog/home-lab-proxmox-docker)).

Only the webserver talks to the internet, and only on ports 22/80/443 —
the firewall makes sure of that ([how I hardened it](/blog/hardening-webserver-in-10-minutes)).
The Docker server never sees the outside world; the webserver reaches it
over the lab network.

## The app: Next.js 16 standalone

The site is a Next.js 16 App Router app built with
`output: "standalone"`, which produces a minimal server folder — one
`server.js` plus only the `node_modules` the app actually needs.
Deployment is copying that folder to the webserver and restarting a
systemd unit. No npm install on the server, no build on the server, no
toolchain. That tiny artifact is what makes the agent-driven deploy loop
practical — a deploy is a copy, not an event.

The full nginx + systemd wiring is in [Deploying this site: Next.js +
nginx](/blog/deploying-nextjs-nginx), so I won't repeat it. One Next.js
16 detail matters here though: premium posts are `force-dynamic`, so
the access check runs per request and gated content never ends up in
prerendered HTML. Static generation is great — until it leaks a
subscriber post into the public cache.

## The database: Postgres on the Docker server

Subscriber accounts live in Postgres, running in a container on the
Docker server — deliberately not on the webserver, so a compromise of
the web tier doesn't mean a dump of the accounts table. When a
logged-in visitor opens a premium post, the server checks the session
against the database before serving full content; logged-out visitors
get the teaser and a login prompt.

Postgres on its own VM also means I can back it up independently,
snapshot the whole container, and rebuild the app tier without touching
a single row.

## The AI layer

Three tools, each with one job:

- **OmniRoute** — the gateway. Every model request from the agent goes
  through it, and it routes to whichever provider is up, fastest, and
  cheapest for the job, with automatic fallback when one is
  rate-limited. That's why the pipeline keeps working even when a
  provider has a bad day ([deep dive](/blog/what-is-omniroute)).
- **Hermes Agent** — the operator. It has terminal access to the lab,
  writes the posts, runs the deploy script, opens and closes GitHub
  issues, and messages me on Telegram when something needs a human
  ([what it is](/blog/what-is-hermes-agent)).
- **Honcho** — the memory. Honcho keeps long-term context, so the agent
  doesn't re-learn my preferences every session: which tone to use,
  which placeholders to substitute for internal addresses, which topics
  are done ([what it is](/blog/what-is-honcho)).

The gateway and memory run on the Docker server. The agent runs on my
workstation and reaches everything over the LAN.

## The content pipeline

Every post moves through five stages:

1. **Topic queue.** Ideas live as GitHub issues, labeled and
   prioritized. The queue is public — you can literally see what's
   coming next.
2. **Draft.** Hermes writes the post into `content/posts/` as markdown
   with frontmatter: title, date, tags, excerpt, and the `premium: true`
   flag for subscriber posts.
3. **Review.** I read it; the agent iterates. Standing rules are
   enforced at this stage: no internal IPs, no domain names, no
   secrets — anything internal gets replaced with a
   `<YOUR_SERVER>`-style placeholder, because the repo is public.
4. **Deploy.** The agent commits and pushes, then runs the deploy
   script. The script lives outside the repo — that's where the
   credentials live — and it builds on the workstation, ships the
   standalone output to the webserver, restarts the service, then
   verifies live: the route returns 200, security headers are intact,
   and the premium gate still locks when logged out. No deploy gets
   closed out unverified.
5. **Newsletter.** Listmonk, running on the Docker server, picks up the
   new post and sends subscribers the excerpt with a link — login
   required for premium content. Same list, same pipeline, every post.

## Why GitHub issues for everything

The standing rule is: every task gets an issue, the work gets done, and
the issue is closed with the commit SHA and verification evidence. That
sounds bureaucratic for a one-person blog, but it's what makes the
agent model work. The repo is the agent's paper trail — what it did,
when, and proof it verified the result. If something breaks, the fix
history is searchable. And because the agent manages the issues itself,
the loop is fully closed: plan → do → verify → record, no human
babysitting.

## Guardrails

An agent with SSH access to servers and a token that can push to GitHub
is a powerful thing, so the setup is deliberately boring:

- credentials live in the agent's local environment, never in the repo
- the deploy script is outside the repo by design
- posts are scrubbed of internal details before they're committed
- every deployment ends with a verification step before the issue closes
- I review anything the agent writes before it ships

The agent does the work; I own the outcome.

## What it costs

This whole machine — blog, database, auth, gating, newsletter, and an
AI agent operating it — costs essentially nothing beyond the lab's
electricity. Models are routed through free tiers where possible, and
the infrastructure is all open source. That's the point of this series:
a modern, automated, self-hosted publishing platform that runs on your
own hardware and answers to you.

*Not a subscriber yet? Logging in with a verified account unlocks this
post and everything above it — see the [subscriber series
overview](/blog/subscriber-only-teaser).*
