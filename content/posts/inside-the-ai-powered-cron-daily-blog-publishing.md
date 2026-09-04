---
title: "Inside the AI-Powered Cron: How I Automated Daily Blog Publishing"
date: "2026-09-04"
excerpt: "A deep dive into the cron job that drafts, builds, security-scans, deploys, and verifies two blog posts every day — completely hands-off, with no human in the loop."
tags: ["automation", "ai", "devops", "subscriber-only"]
premium: true
---

Every day, at a scheduled time, a cron job runs on my homelab and publishes two blog posts. It picks topics from a queue, drafts the content, builds the Next.js site, scans for leaked secrets, commits to GitHub, deploys to the live server, verifies HTTP 200 on both URLs, re-indexes search, and sends me a Telegram message with the result.

I don't touch it. I'm usually asleep.

This post is the detailed autopsy of how that system works — the architecture, the failure modes, the security rules it enforces, and the specific decisions that make it reliable rather than just interesting.

## The mental model: a principal engineer as a cron job

The foundation is Hermes Agent, running on a scheduled cron. But the key design choice isn't the tools — it's the **persona**.

Rather than prompting a generic AI to "write a blog post," the cron job invokes a principal engineer persona: someone with 20+ years of experience, who prefers evidence-based reasoning, never guesses, checks their own work, and cares about security. That persona is instantiated as a system prompt and given explicit rules:

- Never commit to a public repo with internal IPs in the content
- Build must pass before deploy — no exceptions
- Verify live HTTP 200 before reporting success
- If the build fails, stop and report the error — do not improvise

The AI doesn't "decide" to skip the build check when it's inconvenient. The rules are structural, not advisory. This is the difference between an AI that helps and an AI that ships.

## The topic queue: structured input, predictable output

The pipeline starts with `content/topics.md` — a simple markdown file:

```markdown
- [ ] Title | tag1,tag2 | public | pending
- [x] Title Already Published | tag1,tag2 | public | published
- [ ] Subscriber Deep-Dive | tag1,tag2 | subscriber | pending
```

The cron job reads this file, picks exactly one `pending` public topic and one `pending` subscriber topic, and ensures no existing slug in `content/posts/` matches the chosen titles. This prevents duplicate posts.

The format is deliberately machine-readable. The job uses `grep` and simple string matching — no parsing libraries, no fragile JSON. When the format is simple, failures are obvious.

After publishing, the job updates the file in place: `- [ ]` becomes `- [x]` and `pending` becomes `published`. The queue is self-maintaining — the job that reads it also writes it.

## Security as a hard constraint, not a suggestion

The repo is public. Everything committed to it is visible to anyone with a browser. That means the job enforces a strict security policy before every commit:

```bash
grep -nEi "192\.168\.|10\.0\.|172\.(1[6-9]|2[0-9]|3[01])\.|rwomehyo|password|api[_-]?key|secret" \
  content/posts/<slug1>.md content/posts/<slug2>.md
```

Any hit blocks the commit. The post content is rewritten with generic placeholders: `<YOUR_HOST>`, `<YOUR_DOMAIN>`, `<YOUR_SERVER>`, `<YOUR_USERNAME>`. These aren't cosmetic — they're the difference between a public tutorial and a reconnaissance map of a private network.

The same rule applies to the git diff:

```bash
git diff | grep -nE "192\.168\.|password|api[_-]?key|token|secret"
```

The job doesn't trust its own output. It verifies it before signing off.

Beyond content, the infrastructure separation matters:

- The deploy script lives at `~/.hermes/scripts/` — outside the repo, never committed
- Credentials live in `~/.hermes/creds/` — outside the repo, never printed
- The `.env.local` file is gitignored — environment values travel to the server separately, not through Git

The rule is: **if it's a secret, it doesn't touch the repo**. Not even in a commit that immediately reverts it. Commit history is permanent.

## The build gate: the single most important step

The build is the quality gate. The job runs `npm run build` and checks the exit code:

- Exit 0: proceed
- Non-zero: stop, do not commit, do not deploy, report the error as the final message

This sounds obvious. It isn't. The temptation in automated pipelines is to keep going — "maybe it'll work on the server," "maybe the error is non-critical." This is how production sites go down.

The build does three useful things beyond compiling TypeScript:

1. **Type checking** catches logic errors in frontmatter parsing, API handlers, and component props
2. **Route table generation** reveals missing dynamic segments — if a new post's slug contains characters that the route handler rejects, you find out at build time, not when a user hits 404
3. **Static generation** surfaces runtime-adjacent errors — a `cookies()` call outside a dynamic route, a missing environment variable that a module tries to read at import time

In Next.js 16 with standalone output, the build produces `.next/standalone/` — a self-contained directory with the compiled server, pages, and all dependencies. This artifact is what gets shipped to the production server. No `npm install` on the server. No build failures at runtime.

One critical gotcha: after changing route semantics (like adding `export const dynamic = "force-dynamic"` to a post page), you must delete `.next/` before rebuilding. Otherwise, stale on-demand prerenders may serve cached content that bypasses the premium gate. The job always runs the build from a clean state.

## The deploy step: SSH, rsync, and systemd

The deploy script does three things:

1. Builds standalone (again — the deploy script owns its own build, independent of the job's build gate)
2. `rsync`s the `.next/standalone/` directory to the production server over SSH
3. Restarts the systemd service that runs `node server.js`

The production server runs nginx in front of the Next.js server — nginx handles TLS termination via a Cloudflare Origin certificate and proxies to `127.0.0.1:<PORT>`. The Next.js server never touches the internet directly.

The job doesn't print the deploy script's contents or the credentials it reads. It runs the script and checks whether it exited 0. That's the boundary: the job knows the script exists and whether it succeeded. The internals are not its concern.

## Verification: don't trust the deploy, verify the URL

After deployment, the job hits each new post's URL directly:

```bash
curl -s -o /dev/null -w "%{http_code}" https://<YOUR_DOMAIN>/blog/<slug>
```

Expected: `200`. If either URL returns anything else, the job re-runs the deploy script once and checks again. If it still fails, the final report says so explicitly.

This step catches a class of failure that build success doesn't: the server restarted correctly, but the route resolves differently than expected. A misconfigured nginx location, a stale prerender, a missing `.env.local` on the server causing a module to crash at runtime. These don't show up in the build. They show up in the HTTP response code.

For the subscriber post, there's an additional check:

```bash
curl -s https://<YOUR_DOMAIN>/blog/<slug> | grep -c "log in to read"
```

Expected: `1`. The premium gate must still work. An unauthenticated request to a premium post should hit the lock screen, not the content. If the gate is broken, an unsubscribed reader gets the article for free and a subscriber has no reason to pay.

## Search re-indexing: the forgotten final step

After posts are live, the Meilisearch index needs updating. The indexer script reads all posts from the repo, extracts their content, and upserts them into Meilisearch:

```bash
node scripts/index-search.mjs
```

Output on success: `Indexed N posts`. If Meilisearch isn't reachable (container down, environment variables not loaded), the job reports the error. Stale search results are a real user-facing failure — someone searches for a post that's been live for three days and gets no results.

The environment variables for Meilisearch come from `.env.local`. There's a subtle gotcha here: if `.env.local` was sourced in the same shell session and then a `NEXT_PUBLIC_*` variable was changed, the old value persists in the environment and overrides `.env.local` on the next build. The job unsets relevant variables before each build to prevent this.

## Failure modes and what happens when they fire

| Failure | What the job does |
|---|---|
| topics.md has no pending topics | Adds new topics to the queue and continues |
| Security scan hits in post content | Rewrites with placeholders, re-scans, aborts if still dirty |
| `npm run build` fails | Stops. No commit, no deploy. Reports error as final message |
| push auth fails | Reads GITHUB_TOKEN from `.hermes/.env`, pushes via HTTPS. Never prints the token |
| Deploy script fails | Reports exit code and stderr. Does not retry more than once |
| Live URL returns non-200 | Re-runs deploy once, re-checks. Reports outcome either way |
| Search indexer errors | Reports the error. Does not block the report |

The design principle: **fail loudly, fail early, never silently succeed at the wrong thing**. A job that silently deploys a broken post is worse than one that stops and sends a Telegram alert. The user reads one Telegram message every day — if it's marked failure, they know exactly what to investigate.

## The Telegram notification: structured, concise, actionable

Every run ends with a Telegram message, regardless of outcome. Success looks like:

```
✅ Daily publish complete
• New post: Ansible for Homelabs (public)
  → https://<YOUR_DOMAIN>/blog/ansible-for-homelabs
• New post: Inside the AI-Powered Cron (premium)
  → https://<YOUR_DOMAIN>/blog/inside-the-ai-powered-cron
• Build: PASSED
• Commit: abc1234
• Deploy: OK
• Live HTTP: 200 / 200
• Search: Indexed 49 posts
```

Failure looks like:

```
❌ Daily publish failed
• Stage: npm run build
• Error: Type error in src/lib/posts.ts:47
  Property 'premium' does not exist on type 'PostMeta'
• No commit, no deploy.
```

The user reads the message, knows the state, and has the context to respond. No digging through logs unless they want to.

## What this is actually teaching me

Running a production pipeline through an AI cron job is an experiment in **specification**. When a human does the deploy, they interpret ambiguous situations — "the build has a warning, but it's not an error, so I'll push anyway." An AI follows the spec.

That means the spec has to be right. Every edge case I haven't anticipated becomes a failure or, worse, a silent wrong decision. Building this pipeline has forced me to write down every rule I used to hold in my head: what counts as a secret, what counts as a build failure, what counts as verification, when to retry and when to stop.

The result is a system that's more disciplined than I am at 2 AM. It doesn't skip the security scan because it's tired. It doesn't push because it "feels pretty sure the build is fine." It does exactly what the spec says, every time.

That's the real value: not the automation, but the clarity it demands.
