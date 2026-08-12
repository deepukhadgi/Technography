---
title: "Building a Self-Hosted Blog with AI-Powered Automation"
date: "2026-08-12"
excerpt: "A behind-the-scenes look at how an AI agent drafts, builds, scans, deploys, and indexes two blog posts every day — with zero human intervention after the topic queue is filled."
tags: ["ai", "automation", "blog", "self-hosting", "hermes", "subscriber-only"]
premium: true
---

# Building a Self-Hosted Blog with AI-Powered Automation

Most self-hosted blogs are static: you write, you commit, the host rebuilds. That works until you want to publish consistently without spending hours on each post.

This is the story of how I turned a Next.js blog into a semi-autonomous publishing pipeline — one that drafts, builds, deploys, and indexes two posts every day, guided by an AI agent and a simple topic queue.

## The Problem I Was Solving

I wanted to publish twice a week: one public DevOps tutorial and one subscriber-only deep dive. Writing both from scratch every time was unsustainable. But I didn't want to outsource writing to a tool that produced generic filler. I wanted the posts to reflect real infrastructure decisions, actual configs, and honest lessons from running a homelab.

The solution: a structured topic queue, an AI agent that follows a strict workflow, and an automated pipeline that handles everything from build to deployment to search indexing.

## The Topic Queue

Everything starts with `content/topics.md`. It's a plain markdown file with two sections:

```markdown
## Public Posts (DevOps tutorials, homelab guides)

- [ ] Next.js 16 Standalone Deployment: The Complete Guide | nextjs,deployment,nginx | public | pending
- [ ] Nginx Reverse Proxy: From Zero to Production | nginx,reverse-proxy,ssl | public | pending

## Subscriber Posts (Deep dives, behind-the-scenes)

- [ ] Building a Self-Hosted Blog with AI-Powered Automation | ai,automation,blog | subscriber | pending
```

Each line encodes the title, tags, audience, and status. The agent reads this file, picks one `pending` public post and one `pending` subscriber post, and never reuses a title whose slug already exists in `content/posts/`.

The queue is human-curated. I add topics as ideas come up. The agent handles the rest.

## The Agent Workflow

The publishing agent follows a strict 10-step pipeline. Each step has a gate — if anything fails, the pipeline stops and reports the error.

### Step 1: Read the Queue

The agent reads `topics.md`, filters for `pending` entries, and verifies slug uniqueness against the existing post directory.

### Step 2: Create GitHub Issues

Before writing a single line, the agent creates a GitHub issue for each post. This gives us a traceable record and a place to attach verification evidence later. The issue stays open until the post is live and verified.

### Step 3: Write the Posts

The agent generates 800–1500 words per post. The public post is a tutorial with code blocks, concrete steps, and numbers. The subscriber post is a behind-the-scenes deep dive into the architecture, the decisions, and the failures.

Security is critical here. The repo is public on GitHub. The agent scans every line for:

- Internal IP ranges (`192.168.*`, `10.*`, `172.16–31.*`)
- System usernames
- Passwords, tokens, API keys
- Internal hostnames

Any match gets replaced with placeholders: `<YOUR_HOST>`, `<YOUR_DOMAIN>`, `<YOUR_SERVER>`. The only real domain allowed in post content is the public blog domain itself.

### Step 4: Security Scan

After writing, the agent runs a grep over both files:

```bash
grep -nEi "192\.168\.|10\.0\.|172\.(1[6-9]|2[0-9]|3[01])\.|<YOUR_USERNAME>|password|api[_-]?key|secret" content/posts/*.md
```

If anything matches in the body, the post is rewritten. Only a generic sentence containing the word "token" is acceptable — a real secret is not.

### Step 5: Mark Topics as Published

The agent updates `topics.md`, changing `- [ ]` to `- [x]` and `pending` to `published` for the two picked entries.

### Step 6: Build Gate

The agent runs `npm run build`. If the build fails — TypeScript error, route table collision, missing dependency — the pipeline stops. No commit, no deploy. The error is reported and the issues stay open.

### Step 7: Commit and Push

On a successful build, the agent commits with a conventional message and pushes to `origin main`. Auth is handled by a credential helper — the token never appears in logs.

### Step 8: Deploy

The agent runs the deploy script, which builds the standalone output, rsyncs it to the webserver VM, and restarts the systemd service. The script reads credentials from a secured directory outside the repo.

### Step 9: Verify Live

The agent hits each new post URL with `curl` and confirms HTTP 200. It also checks that security headers are present and that the premium gate still locks subscriber content when unauthenticated.

### Step 10: Re-index Search

After a successful deploy, the agent runs the Meilisearch indexing script. It prints the number of posts indexed. If the script errors, the pipeline reports the failure but the posts are still live.

## The Infrastructure

Here's what runs behind the scenes:

- **Blog engine**: Next.js 16 with App Router, TypeScript, standalone output
- **Auth**: Custom session-based auth with encrypted cookies; premium gate checks on every request
- **Search**: Meilisearch, re-indexed after each deploy
- **Analytics**: Umami, served through an nginx proxy to keep internal IPs out of public HTML
- **Email**: Postfix on the Docker server, relayed through SMTP2GO for delivery
- **Hosting**: A webserver VM behind nginx, TLS terminated at Cloudflare
- **CI/CD**: The deploy script runs on a cron schedule; the agent executes it as a scheduled job

## What the Agent Can't Do (Yet)

The current pipeline is strong on structure but weak on originality. The agent follows a template: intro, problem statement, steps, verification, pitfalls. The content is accurate because it's based on real experience, but the prose can feel uniform across posts.

Potential improvements:

- **Style variation**: Inject tone descriptors into the prompt so each post doesn't sound like the same voice.
- **Image generation**: Add diagrams or architecture sketches generated from post content.
- **Peer review**: Have a second agent critique the post for accuracy before it goes live.
- **Social snippets**: Auto-generate Twitter/LinkedIn cards from the post excerpt and tags.

## Lessons Learned

**Never skip the build gate.** I once deployed a post with a broken import and spent 20 minutes debugging a 404 that was actually a build error. The build must pass before anything else.

**Security scans save reputations.** A single leaked internal IP in a public post would undermine the credibility of a blog that claims to teach security. The grep is cheap insurance.

**Stale `.next` caches cause silent bugs.** When route semantics change (like adding auth checks), the prerendered output can leak gated content. Purging `.next/` before rebuild is non-negotiable.

**The topic queue is the bottleneck.** The agent can publish fast, but it can't create topics. I need to keep the queue filled or the pipeline stalls. A good rule of thumb: maintain at least 4 public and 2 subscriber topics ahead of schedule.

## The Result

Two posts per day, published automatically, with human-curated topics and AI-executed workflow. The posts are technically accurate, security-scanned, and indexed for search. The only human step left is adding topics to the queue.

That's the automation I wanted: not replacing the writer, but removing the friction between idea and publish.
