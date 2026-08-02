---
title: "What is Hermes Agent? The self-improving AI agent from Nous Research"
date: "2026-08-01"
excerpt: "Beyond chatbots and coding copilots — an autonomous agent with a built-in learning loop. Skills, persistent memory, 60+ tools, and 20+ platforms. Here's what Hermes Agent actually is and how powerful it really is."
tags: ["hermes-agent", "ai", "agents", "self-hosting"]
---

Most AI assistants are stateless. You ask, they answer, the conversation
ends — and tomorrow they know nothing about yesterday. That works for a
chatbot. It's a useless foundation for an *agent*.

An agent doesn't just answer questions. It executes tasks — writes code,
runs commands, deploys services, monitors infrastructure — and it ought to
get better at those tasks the longer it runs. That last part is where almost
every tool out there quietly stops. Hermes Agent is one of the few that
doesn't.

This post is part 2 of my self-hosted AI series — [part 1 covered wiring
Hermes to OmniRoute for free models](/blog/omniroute-hermes-agent), and
[part 3 is a deep dive on OmniRoute itself](/blog/what-is-omniroute),
and [part 4 covers Honcho — AI-native memory](/blog/what-is-honcho).
Here I go deeper into what Hermes Agent is, how its learning loop works,
and what it can actually do.

## Not a copilot, not a wrapper

Hermes Agent is an open-source AI agent framework built by **Nous
Research** — the same lab behind the Hermes, Nomos, and Psyche model
families. It's in the same category as Claude Code or OpenAI Codex, with one
fundamental difference in design:

- A **coding copilot** lives inside your IDE and helps with code.
- A **chatbot wrapper** is one API key, one model, one chat window.
- Hermes is an **autonomous agent** that lives on your infrastructure, has
  real tools, remembers you across sessions, and learns procedures as it
  works.

It runs on Linux, macOS, Windows, and WSL. It's MIT-licensed. And it works
with any LLM provider — Nous Portal, OpenRouter, OpenAI, Anthropic, Google,
DeepSeek, local models, or any OpenAI-compatible endpoint.

## The learning loop — the part nobody else has

Here's the design that makes Hermes different. It maintains a **closed
learning loop**: everything it learns in one session improves the next one.

**Skills.** When Hermes figures out a non-trivial workflow — deploying a
web app, provisioning a VM, debugging a service — it saves the procedure as
a *skill*: a structured document with steps, exact commands, and pitfalls.
Next time the same kind of task appears, the skill loads automatically and
the job starts from a known-good playbook instead of from scratch.

**Self-improvement during use.** Skills aren't static. If a skill turns out
outdated or wrong mid-task, Hermes patches it on the spot. The knowledge
base isn't a library that decays — it's a codebase that gets maintained.

**Persistent memory.** Hermes keeps an agent-curated memory of who you are:
your preferences, your environment, your corrections. It nudges itself to
save what matters, and it builds a deepening model of the user across
sessions. You shouldn't have to re-explain yourself to your own agent.

**Cross-session recall.** Every past conversation is indexed and searchable
(FTS5 with LLM summarization on top). "Didn't we already solve this?" is
answered from actual session history, not from a hallucinated guess.

The result compounds. Every session makes the next one faster, because
procedures are saved, mistakes are remembered, and context survives. That
single loop — learn, save, reuse, improve — is what separates a tool from
an agent that *gets more capable the longer it runs*.

## What it can do

**Real tools, not just chat.** Hermes ships with 60+ built-in tools:
terminal execution, file editing, web search, page extraction, browser
control, vision, image generation, text-to-speech, scheduled cron jobs,
subagent delegation, and even desktop control. It doesn't *describe* what
it could do — it does it, with real side effects you can verify.

**Lives wherever you put it.** The same agent core drives a CLI, a native
desktop app, a web dashboard, and a messaging gateway that reaches 20+
platforms: Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost,
Microsoft Teams, Google Chat, email, SMS, Home Assistant, and more. Talk to
it on Telegram while it works on a server you never SSH into yourself.

**Runs anywhere, not just your laptop.** Six terminal backends: local,
Docker, SSH, Daytona, Singularity, and Modal. It'll happily live on a $5
VPS, or on serverless infrastructure that hibernates when idle and costs
nearly nothing.

**Provider-agnostic.** Swap models and providers mid-workflow. Point it at
any OpenAI-compatible endpoint — including your own self-hosted gateway.
No vendor lock-in by design.

**Delegates and parallelizes.** It spawns isolated subagents for parallel
workstreams — research one thing while building another — and merges the
results. Multi-step pipelines can collapse into single inference calls
through programmatic tool calling.

**Extends in open ways.** Connect any MCP server for additional tools. Its
skills follow an open standard compatible with agentskills.io — skills are
portable, shareable, and community-contributed via the Skills Hub.

**Under the hood.** Configuration is split cleanly: settings in
`config.yaml`, secrets in `.env`. Sessions live in a local SQLite store
with full-text search. A `SOUL.md` file defines the agent's voice, and
project context files shape how it behaves inside a given repository.

## How powerful is it, really?

Let's be concrete. The site you're reading this on — this blog — was built
and deployed by Hermes Agent: the Next.js code, the build, the nginx
config, the deployment to a server, the Git history. That's not a demo. It
happened end-to-end in an afternoon.

In my homelab it does the same class of work at scale:

- **Provisioned and configured VMs** — installed operating systems,
  hardened SSH, set up users, verified networking.
- **Deploys and manages services** — builds apps, ships them to servers,
  restarts services, checks they're actually healthy afterwards.
- **Watches infrastructure** — scheduled automations ping me on Telegram
  when something needs attention.
- **Manages the codebase** — commits, pushes, and keeps GitHub as the
  visible record of everything it does.

None of that is magic. It's a tool-using agent with persistent memory and a
skill system — but that combination is exactly what turns "AI that chats"
into "AI that does the job, remembers how, and gets faster at it every
week."

Honest limits: it's only as good as the models you point it at, and you
should review what it does on critical systems. You're not hiring an
unlimited employee — you're hiring one that shows its work, keeps a record,
and takes direction.

## Try it yourself

Installing takes one command on Linux or macOS:

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

Then run `hermes setup` to pick a provider and model, or fire off a single
query:

```bash
hermes chat -q "What is Docker?"
```

For the self-hosted angle, part 1 of this series shows how to point it at
your own AI gateway — hundreds of models through one local endpoint, free
tiers included: [Running Hermes Agent with OmniRoute](/blog/omniroute-hermes-agent).
And if you want the full story on the gateway itself, [part 3 breaks down
what OmniRoute actually is](/blog/what-is-omniroute).
For the memory layer that makes the agent truly understand you,
[part 4 covers Honcho — AI-native memory](/blog/what-is-honcho).

## The takeaway

Chatbots answer. Agents act. Hermes Agent is one of the few agents designed
so that acting gets *easier* over time — skills it creates, memories it
keeps, and procedures it improves across every session. Run it on your own
hardware with your own model endpoints and you get an autonomous agent that
actually works for you, on your terms.
