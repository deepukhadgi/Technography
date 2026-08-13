---
title: "The Technography Deployment Pipeline: From Topic to Live Site in Minutes"
date: "2026-08-13"
excerpt: "How a Next.js blog goes from a markdown file in a topic queue to a live URL — the automation, the gotchas, and the scripts that make it all work."
tags: ["devops", "automation", "nextjs", "ci-cd", "subscriber-only"]
premium: true
---

Every post on this site goes through the same pipeline. I write a markdown file, run a build, ship it to a server, and verify it live — all in under five minutes. This post is a behind-the-scenes look at exactly how that works, the scripts involved, and the pitfalls I've learned to avoid.

If you're running a Next.js blog (or any static-ish site) on your own infrastructure, much of this applies directly.

## The Pipeline in Seven Steps

1. **Draft** the post in `content/posts/<slug>.md`
2. **Build** with `npm run build` (TypeScript check + route table generation)
3. **Security scan** the diff — no internal IPs, credentials, or hostnames leak into the public repo
4. **Commit and push** to GitHub
5. **Deploy** via a shell script that builds standalone, ships it over SSH, and restarts the service
6. **Verify live** with curl against the production URL
7. **Re-index search** by running the search indexer script

Steps 1–4 are manual (or AI-assisted). Steps 5–7 are scripted. Here's what each piece does.

## Step 1 — The Topic Queue

Posts don't go straight from my head to the repo. They live in `content/topics.md` first:

```markdown
- [ ] Title Here | tag1,tag2 | public | pending
- [x] Title Already Published | tag1,tag2 | public | published
- [ ] Subscriber Deep-Dive | tag1,tag2 | subscriber | pending
```

The checkbox and status let me scan the queue at a glance. When I'm ready to publish, I pick a `pending` item, write the post, and flip the status to `published` (and the checkbox to `[x]`).

This separation between topic and post is deliberate. It means I can queue up ten ideas and publish them over the course of a week without cluttering the repo with work-in-progress files.

## Step 2 — The Build

Next.js 16 with standalone output is the engine. The build command does three things:

- **TypeScript compilation** — catches type errors before they reach production
- **Route table generation** — maps every page in `app/` to a server route
- **Standalone output** — produces a self-contained `.next/standalone/` directory that includes the Node.js server, the compiled pages, and all npm dependencies

The standalone output is what makes deployment simple. Instead of shipping source code and installing dependencies on the server, I ship the already-built artifact. The server VM just runs `node .next/standalone/server.js` and nginx proxies to it.

One critical rule: **never skip the build**. I've learned this the hard way. A TypeScript error that slips past linting will crash the server at runtime. The build is the gate.

## Step 3 — Security Scan

The repo is public on GitHub. Everything in it is visible to anyone. That means:

- No internal IP addresses (use `10.0.0.0/8` or `<YOUR_HOST>` as placeholders)
- No system usernames
- No passwords, tokens, or API keys
- No internal hostnames

I scan every new file with a simple grep before committing:

```bash
grep -nEi "192\.168\.|10\.0\.|172\.(1[6-9]|2[0-9]|3[01])\.|password|api[_-]?key|secret|token" content/posts/*.md
```

And I scan the full diff:

```bash
git diff | grep -nE "192\.168\.|password|api[_-]?key|token|secret"
```

If either returns a hit, I rewrite the offending line with a placeholder before committing. This has saved me from accidental leaks more than once.

## Step 4 — Commit and Push

```bash
git add content/posts/<slug>.md content/topics.md
git commit -m "feat: publish <short title>"
git push origin main
```

The commit message follows conventional commits: `feat:` for new posts, `fix:` for corrections. GitHub Actions aren't involved — the push is the trigger. The deploy script runs next.

## Step 5 — The Deploy Script

The deploy script lives outside the repo at `~/.hermes/scripts/technography-deploy.sh`. It does three things:

1. **Builds standalone** on the local machine (`npm run build`)
2. **Ships the artifact** to the webserver VM via `rsync` over SSH
3. **Restarts the service** on the remote machine

The script reads credentials from `~/.hermes/creds/` — never from the repo. The webserver VM runs a systemd service that keeps the Next.js standalone server alive and nginx in front of it.

Why outside the repo? Because the script contains SSH credentials and server addresses. Keeping it out of Git means I never have to worry about accidentally committing secrets.

## Step 6 — Live Verification

After deploy, I run a quick health check:

```bash
curl -s -o /dev/null -w "%{http_code}" https://<YOUR_DOMAIN>/blog/<slug>
```

Expected: `200`. If it's anything else, I re-run the deploy script once and check again. I also verify that the premium gate still works by checking that unauthenticated requests to subscriber-only content return the login prompt instead of the post body.

## Step 7 — Search Re-Index

The blog uses Meilisearch for full-text search. After new posts go live, I re-index:

```bash
set -a && . ./.env.local && set +a
node scripts/index-search.mjs
```

The script reads all posts from the repo, extracts their content, and upserts them into Meilisearch. It prints `Indexed N posts` on success. If the environment variables aren't loaded correctly, Meilisearch won't receive the updates and search results will be stale.

## The Gotchas

Over time, I've accumulated a list of things that bite you if you're not careful:

- **Stale `.next/` builds**: If you change route semantics (like adding `export const dynamic = "force-dynamic"`), delete `.next/` before rebuilding. Otherwise, Next.js may serve cached prerenders.
- **Environment variable leakage**: `set -a && . ./.env.local` exports variables into the shell. If you change a `NEXT_PUBLIC_*` variable, you must `unset` it before rebuilding, or the old value persists and overrides `.env.local`.
- **remark-html sanitization**: The markdown renderer strips custom HTML by default. If your post needs `<figure>` or `<img>` tags, pass `{ sanitize: false }` to the plugin. This is safe for git-authored content but never use it with user input.
- **Force-dynamic on all posts**: Every post page uses `export const dynamic = "force-dynamic"`. This means the premium gate runs on every request. Public posts are still fast because they render from local markdown, not from a database.

## Why This Matters

Running your own blog infrastructure isn't just about saving money on hosting. It's about control. When the deploy script breaks, you fix it. When a post doesn't appear, you check the build logs. When Meilisearch goes stale, you re-run the indexer.

The pipeline I described here takes about three minutes from `git push` to live verification. That's fast enough that I publish daily without thinking about it. And it's simple enough that I understand every step — which means when something goes wrong, I know exactly where to look.
