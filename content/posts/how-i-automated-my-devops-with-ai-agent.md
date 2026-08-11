---
title: "How I Automated My DevOps with an AI Agent"
date: "2026-08-08"
excerpt: "Behind the scenes of this site's AI ops layer: how a Hermes-style agent runs the daily publish pipeline, turns every bug into a GitHub issue, watches its own deploys, and remembers what it learned — plus the honest failure modes and the guardrails that keep it safe."
tags: ["ai", "devops", "automation", "hermes", "subscriber-only"]
premium: true
---

Every morning at 06:00, a cron job wakes up an AI agent on a small
virtual machine in my home lab. By the time I've had coffee, two blog
posts have been drafted, type-checked, scanned for leaked
credentials, committed to a public GitHub repository, deployed to the
web server, verified live with real HTTP requests, and re-indexed in
the search engine. If anything in that chain fails, I get a Telegram
message with the exact error.

I built this because I'm a DevOps engineer who got tired of doing the
same deploy dance by hand. This post is the full behind-the-scenes
tour: how the automation is structured, where the AI is genuinely
useful, where it isn't, and the guardrails that stop it from setting
the lab on fire.

<figure>
  <img src="/images/how-i-automated-my-devops-with-ai-agent-diagram.png" alt="How I Automated My DevOps with an AI Agent architecture diagram" width="1200" height="600" loading="lazy" />
  <figcaption class="font-mono text-xs text-dim mt-2 text-center">How I Automated My DevOps with an AI Agent system diagram</figcaption>
</figure>
## The shape of an automated day

The whole pipeline is a chain of small, dumb, verifiable steps. The
AI doesn't "magically" deploy anything — it orchestrates tools that
already exist, and every step has a check that must pass before the
next one starts. The chain looks like this:

1. **Draft.** Pick two topics from a queue file, write two markdown
   posts with frontmatter (title, date, excerpt, tags, a `premium`
   flag for subscriber-only content).
2. **Build gate.** Run the production build. A failed build stops the
   pipeline cold — no commit, no deploy. This has saved me more times
   than I can count.
3. **Security scan.** Grep the diff for internal IPs, hostnames,
   account names, and credential-shaped strings before anything touches
   the public repository. The repo is public: every word I write
   there is visible to the world.
4. **Commit and push.** Conventional commit message, pushed to `main`.
5. **Deploy.** A script builds the standalone output, ships it to the
   web server, and restarts the service.
6. **Verify live.** Curl the new post URLs and check for HTTP 200.
   Also check that the security headers are still present and that
   the premium gate still locks subscriber content when logged out.
7. **Re-index.** Sync the posts into Meilisearch so search finds them
   immediately.

The whole chain, from cron trigger to verified URLs, takes a few
minutes. The interesting part is that each step is a *hard gate*: the
agent cannot lie its way past a failed check, because it's not the
one doing the checking.

## Every bug gets an issue

The discipline I run on the code side is: **every task or bug gets a
GitHub issue, the fix gets made, and the issue is closed with the
commit reference and verification evidence.** The agent does the
full loop autonomously:

1. Create the issue with a title, description, and label (`bug` or
   `enhancement`).
2. Implement the fix.
3. Build and smoke-test it.
4. Commit with a reference to the issue, push.
5. Verify the fix is live.
6. Comment on the issue with the commit SHA and the exact check that
   passed — then close it.

Why this matters: a public repo with a clean issue trail is a
portfolio. Every closed issue is a documented, verifiable piece of
work — "this bug existed, here's the fix, here's the commit, here's
the live proof." That's worth more than a hundred commits with
mysterious messages.

## Watching its own work

The agent doesn't deploy and wander off. After every deploy it
verifies live, and it does so with real requests, not vibes:

```bash
curl -s -o /dev/null -w "%{http_code}" https://<YOUR_DOMAIN>/blog/<slug>
curl -sI https://<YOUR_DOMAIN> | grep -ciE "content-security-policy|strict-transport"
```

If a check fails, the deploy script gets re-run once, and if it's
still broken the agent stops and reports the failure — it does not
paper over it. There's a hard rule: **never report a fix as done
without live verification.** A self-report is not evidence.

## Memory: the part that feels like magic

The single most valuable feature isn't the automation itself, it's
that the agent *remembers*. It keeps a persistent memory of my
environment — what runs where, which credentials live in which file
(never displayed, never committed), which commands work and which
don't. Past incidents are searchable: when a strange build error
reappears, the agent can search its own session history and find the
exact fix we used last time, instead of rediscovering it.

It also maintains **skills** — written procedures for recurring tasks.
The deploy runbook, the security-scan checklist, the newsletter
workflow. Each time it hits a new gotcha (an environment variable
that overrides a config file, a proxy rule that breaks on a certain
path), the skill gets patched. The system literally gets better at
its job over time, because every failure is a permanent lesson.

## The guardrails that make this safe

Automation that can run commands on your infrastructure is a loaded
weapon. Mine has four safety layers:

- **Zones.** Some hosts are "operate freely": deploy, restart, edit.
  The host running the AI infrastructure itself is read-only unless I
  explicitly approve a change. No autonomous action crosses that
  line.
- **Nothing sensitive in output.** Credentials are read from files outside
  the repository and never echoed into chat or logs. When a command
  might print one, output is scrubbed before display.
- **Public-repo hygiene.** Anything that lands on GitHub goes through
  the scan: no internal IPs, no hostnames, no account names, no
  credential-shaped strings. Placeholders like `<YOUR_HOST>` and
  `<YOUR_DOMAIN>` take their place. Subscriber-only content is not a
  privacy boundary — the whole repo is public, so everything gets
  the same treatment.
- **Human escape hatches.** Deploys run only after the build gate
  passes, verification must succeed before an issue is closed, and
  anything ambiguous stops the pipeline for a human rather than
  guessing.

## The honest failure modes

Automation with an AI at the center has real failure modes, and I've
hit most of them:

- **Context rot.** Long sessions drift; the agent can "forget" a
  constraint stated at the start. The fix is the same as for human
  engineers: written, versioned runbooks instead of vibes.
- **Overconfident summaries.** An agent that says "deployed and
  verified" is a self-report, not a fact. That's why every step has
  an external check the agent can't fake.
- **Stale environment state.** Shell environment variables persist
  between commands in a session, and a stale value silently overrides
  fresh config. This one caused a real bug: analytics config rebuilt
  with yesterday's value because the variable was still exported in
  the shell. The lesson got written into the runbook, and now the
  pipeline explicitly clears those variables before each build.
- **Token cost.** Every autonomous run burns model tokens. Keeping
  steps small and gated means failures happen early, before the
  expensive parts of the pipeline.

## What this actually costs

The stack runs on hardware I already owned: one virtualization host
for the AI infrastructure, one small server for the web front end.
The AI agent runs as a service on a modest VM with a couple of
gigabytes of RAM. Model calls go through a self-hosted gateway that
routes to free and low-cost model tiers, so the marginal cost of the
entire daily pipeline is close to zero. The real investment was a
weekend of writing the runbook — the skills, the deploy script, the
guardrails. Since then, the system maintains itself.

## Would I recommend it?

If you run a side project or a small site and you've ever found
yourself doing the same six shell commands at 11 p.m. to ship a fix:
yes. Start small — one cron job, one runbook, one hard gate. Let the
agent prove itself on a boring, repetitive task before you let it
touch anything important. And above all: make every step verifiable,
and make the agent prove its work with real output.

The robots aren't taking our jobs. They're taking our *deploys* —
and honestly, they can have them.
