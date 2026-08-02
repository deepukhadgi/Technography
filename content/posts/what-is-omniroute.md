---
title: "What is OmniRoute? One endpoint for 290+ AI providers — free tiers included"
date: "2026-08-01"
excerpt: "The deep dive: an open-source AI gateway that puts 290+ providers behind one OpenAI-compatible endpoint — 19 routing strategies, quota-aware failover, and token compression claiming 15–95% savings. Here's what OmniRoute actually is and how powerful it really is."
tags: ["omniroute", "ai", "self-hosting", "llm", "gateway"]
---

There's an awkward phase every self-hoster hits: you want to use AI without
being locked to one vendor, so you sign up for a few providers. OpenAI here,
Anthropic there, a couple of free tiers you heard about on a forum. Then
reality sinks in — every provider has its own SDK, its own rate limits, its
own billing page, and its own downtime. Your agent code ends up full of
provider-specific logic, and the day one of them rate-limits you mid-task,
everything breaks.

OmniRoute is the answer I found to that mess. This is part 3 of my
self-hosted AI series — [part 1 wired Hermes Agent to OmniRoute](/blog/omniroute-hermes-agent),
and [part 2 went deep on Hermes Agent itself](/blog/what-is-hermes-agent).
Here's the deep dive on the gateway in the middle.

## What it is

OmniRoute is a free, open-source AI gateway, MIT-licensed and written in
100% TypeScript. It sits between your AI tools and every AI provider in
existence, and exposes **one OpenAI-compatible endpoint** on your network.
Anything that can talk to OpenAI's API format — agents, CLIs, scripts, your
own code — can talk to OmniRoute instead.

That one sentence is the whole trick, so let me unpack why it matters.

## The problem it solves

The AI provider landscape is fragmented by design. Today the catalog
counts **290+ providers and 500+ models** — Kimi, Claude, GPT, OpenAI,
Gemini, GLM, DeepSeek, MiniMax, and a long tail of smaller names. Each one
wants you to use their SDK and their console. Each has separate quota,
separate rate limits, separate pricing.

And the free tiers? Stacking them by hand is genuinely painful. Dozens of
accounts, dozens of rate limits, and no honest way to know how much you
actually have left. That's not a workflow, it's a part-time job.

OmniRoute collapses all of that into one endpoint and one dashboard.

## One endpoint, 290+ providers

The headline number: **290+ providers, 500+ models, and 90+ with a free
tier** (40+ free forever). The free-tier story is unusually honest — the
project aggregates the *documented* free tiers of 43 provider pools into a
single figure and shows it live on the dashboard: roughly **1.53 billion
free tokens per month** steady state, more in month one with signup
credits. It's re-audited every two weeks and moves both ways; a provider
ends a free tier and the number drops.

No more spreadsheet of free-tier accounts. You add keys once, and the
catalog — every model, every price, every free quota — is one page.

## 19 routing strategies

You don't have to pick a provider per request. You pick a *strategy*, and
OmniRoute decides. The catalog of 19 strategies covers everything:

- **priority** — drain an ordered list of targets, first to last
- **round-robin** — cycle through in order
- **least-used / p2c** — load-balance by current usage
- **random / strict-random** — with or without de-duplication
- **cost-optimized** — minimize dollars per request from live pricing
- **headroom** — pick whatever has the most quota left
- **auto/offline** — most quota and rate-limit headroom first
- **auto/smart** — quality-first, with 10% exploration to discover better models

You can even chain strategies into **combos** — route by quality first,
fall back to cost, finish on the free tier. That flexibility is what makes
it feel less like a proxy and more like an operations team.

## Quota-aware auto-fallback

This is the feature I rely on most. OmniRoute tracks live quotas and rate
limits for every provider you've configured. When a provider goes down,
hits a rate limit, or runs dry, the gateway automatically fails over to the
next eligible target per your strategy — *before* your agent ever sees an
error.

In my setup this is invisible until it isn't: a model provider dies
mid-task, and the run just continues on another provider. My agent has
never once failed because of upstream rate limits since I turned it on.

## Compression: RTK + Caveman

Tokens are the currency of AI, and OmniRoute ships two stacked compression
passes to spend less of them. The project claims **15–95% token savings,
~89% average** — the two passes (RTK + Caveman) shrink prompts and history
before they hit the model, and it's all transparent to the client.

Fewer tokens means lower cost on paid tiers, more effective context window,
and longer agent sessions before a context cap hits. It's the kind of
feature that quietly saves you money every single day without you noticing.

## Works with everything

Because it's a standard OpenAI-compatible endpoint, the client list is
basically "everything": Claude Code, Codex, Cursor, OpenCode, Cline,
Copilot, Antigravity, custom scripts, and of course agents like Hermes.
There's also a full CLI, MCP support, and A2A (agent-to-agent) — so
different agents on your network can talk through it, not just tools on one
machine.

## Local-first and private

OmniRoute runs on your own hardware — npm package, Docker image, or a
desktop app/PWA. Prompts don't leave your network unless you configure a
provider that sends them somewhere. Your gateway, your data, your rules.
The dashboard gives you the provider catalog, free-tier budget, and live
usage in one place.

## How powerful is it, really?

The honest numbers: hundreds of contributors, a large open-source
community, 290+ providers, 500+ models, and a free-tier budget north of a
billion tokens a month. But raw scale isn't the point — the point is what
the scale *buys*: redundancy. One endpoint with automatic failover means
your AI tooling stops being a single point of failure.

In practice, for me, it meant one `base_url` change and my agent went from
one provider to hundreds — with free tiers, failover, and cost-aware
routing included. The agent never needs to know which model is answering
behind the curtain.

Honest limits: the provider numbers move over time (free tiers end, new
providers land), and you should pick providers whose terms you're happy
with — the project flags providers with questionable terms so you can
decide for yourself. And compression is aggressive by default; if you need
byte-exact prompts, you can tune it.

## Getting started

**npm (single machine):**

```bash
npm i -g omniroute
omniroute launch
```

**Docker (dedicated server):**

```bash
docker run -d \
  --name omniroute \
  -p 20128:20128 \
  --restart unless-stopped \
  ghcr.io/diegosouzapw/omniroute:latest
```

Then open `http://localhost:20128`, add your provider keys, pick a routing
strategy, and point any OpenAI-compatible client at
`http://<host>:20128/v1`. That's the entire setup.

## The takeaway

A gateway is the layer you didn't know you were missing. One endpoint, 290+
providers, 19 routing strategies, quota-aware failover, and token
compression — all free, all MIT-licensed, all running on your own
hardware. Combined with an agent like Hermes, it's the most capable
self-hosted AI stack I've found, and the whole thing costs nothing but the
provider keys you choose to add.

If you want to see it wired to an actual agent: [part 1 shows the exact
Hermes + OmniRoute setup](/blog/omniroute-hermes-agent), [part 2
explains why the agent half matters](/blog/what-is-hermes-agent), and
[part 4 adds AI-native memory with Honcho](/blog/what-is-honcho).
