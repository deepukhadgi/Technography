---
title: "Running Hermes Agent with OmniRoute — free AI models on your own infrastructure"
date: "2026-08-01"
excerpt: "How I installed Hermes Agent and wired it up to OmniRoute as a provider — one local endpoint, hundreds of models, and an AI agent that runs on my terms."
tags: ["omniroute", "hermes-agent", "self-hosting", "ai"]
---

Most AI coding agents lock you into one provider and one bill. I wanted
something different: an autonomous agent that could work from my terminal,
talk to Telegram, write code, manage servers — and not depend on a single
API key. The answer was two open-source projects: **Hermes Agent** and
**OmniRoute**.

<figure>
  <img src="/images/omniroute-hermes-agent-diagram.png" alt="Running Hermes Agent with OmniRoute — free AI models on your own infrastructure architecture diagram" width="1200" height="600" loading="lazy" />
  <figcaption class="font-mono text-xs text-dim mt-2 text-center">Running Hermes Agent with OmniRoute — free AI models on your own infrastructure system diagram</figcaption>
</figure>
## What is Hermes Agent?

Hermes Agent is an open-source AI agent framework built by Nous Research.
Think of it as a personal assistant that lives in your terminal, a desktop
app, or connected to Telegram, Discord, Slack, and a dozen other platforms.

What makes it different from just running a ChatGPT wrapper:

- **Skills** — reusable procedures Hermes saves and loads automatically. Write
  a deploy workflow once, and Hermes remembers it next time.
- **Persistent memory** — remembers your preferences, environment details, and
  corrections across sessions.
- **Tool access** — real terminal, file editing, browser, web search, and
  custom plugins. Not just text in, text out.
- **Multi-surface** — same agent core drives the CLI, a native desktop app, a
  web dashboard, and messaging gateways.
- **Provider-agnostic** — point it at any OpenAI-compatible endpoint and it
  works.

## What is OmniRoute?

OmniRoute is a free, open-source AI gateway. It sits between your agent
(or any client) and every AI provider, exposing one OpenAI-compatible
endpoint: `http://localhost:20128/v1`.

Why this matters:

- **One endpoint, hundreds of providers** — OpenAI, Anthropic, Google,
  DeepSeek, Mistral, Groq, and many more, including 90+ free-tier models.
- **Auto-routing** — pick a routing strategy and OmniRoute picks the best
  provider for each request based on availability, latency, or your
  preferences.
- **Fallback and retries** — if one provider goes down or hits a rate limit,
  it automatically tries the next.
- **Compression** — built-in token compression (RTK + Caveman) that claims
  15–95% token savings without losing quality.
- **Local-first** — runs on your own hardware. No data leaves your network
  unless you configure it to.

## Installing Hermes Agent

Hermes installs with a single curl command on Linux/macOS (or a PowerShell
one-liner on Windows). The installer handles everything: uv, Python, Node.js,
ripgrep, ffmpeg, and a portable Git.

```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```

After installation, Hermes lives at `~/.hermes/hermes-agent/`. The first time
you run `hermes`, it launches the interactive setup wizard where you pick a
provider and a model.

```bash
# launch the agent
hermes

# or run a single query
hermes chat -q "What is Docker?"
```

From here Hermes has access to your terminal, files, web search, browser
control, and anything you configure through plugins.

## Installing OmniRoute

OmniRoute is also straightforward. Two main options:

**npm (recommended for single-machine setups):**

```bash
npm i -g omniroute
omniroute launch
```

**Docker (good for a dedicated server or containerized homelab):**

```bash
docker run -d \
  --name omniroute \
  -p 20128:20128 \
  --restart unless-stopped \
  ghcr.io/diegosouzapw/omniroute:latest
```

Once OmniRoute is running, open `http://localhost:20128` in your browser.
The web dashboard walks you through:

1. Adding provider API keys (OpenAI, Anthropic, Groq, etc.)
2. Picking a routing strategy (auto, round-robin, lowest-latency, etc.)
3. Testing the endpoint with a quick chat completion

The key thing to know: OmniRoute listens on port **20128** by default and
exposes a standard OpenAI-compatible `/v1` API. Any tool that talks to
OpenAI's API format can use it.

## Connecting Hermes to OmniRoute

This is where it all comes together. In Hermes, the provider config lives
in `~/.hermes/config.yaml`. You point Hermes at OmniRoute as a custom
provider:

```yaml
model:
  default: auto/best-coding
  provider: custom
  base_url: http://<your-omniroute-host>:20128/v1
  api_key: <your-api-key-if-configured>
```

That's it. The `base_url` is OmniRoute's endpoint. Hermes treats it like
any OpenAI-compatible provider — it discovers available models, handles
streaming, tool calls, and vision requests through the same pipeline.

A few things worth noting:

- **`auto/best-coding`** tells Hermes to use the auto-routing model and
  pick the best available coding model for each turn. OmniRoute handles the
  actual provider selection.
- **OmniRoute's API key** is optional if you're running it locally with no
  authentication. If you enable auth on OmniRoute (recommended for
  production), put the key in the config or the `.env` file.
- **The `base_url` can point anywhere on your network** — OmniRoute doesn't
  have to run on the same machine as Hermes. In my setup, OmniRoute runs on
  a dedicated server in the homelab, and Hermes talks to it over the LAN.

## What this gives you

The end result is an AI agent that:

- Runs from your terminal with full tool access (terminal, files, browser)
- Routes through hundreds of models via one local endpoint
- Falls back automatically when a provider is down or rate-limited
- Uses free-tier models where available
- Never sends your prompts through a third-party router
- Works with Telegram, Discord, Slack, or just the CLI

All running on your own hardware, on your own network.

## What I use it for

I run Hermes on my workstation, connected to OmniRoute on a separate homelab
server. The agent writes code, deploys to my webserver, manages Docker
containers, and keeps me updated through Telegram. When a model provider
goes down mid-task, OmniRoute just routes to the next one — I never see the
failure.

The whole stack is open source, self-hosted, and costs nothing beyond the
provider API keys you choose to use (many of which are free tier).

If you're running any kind of homelab, the combination of Hermes Agent +
OmniRoute is the most capable self-hosted AI setup I've found. Two
projects, one configuration change, and you have an autonomous agent that
actually does things.

*Part 2 of this series digs into Hermes Agent itself — the learning loop,
the tool system, and why it gets more capable the longer it runs:
[What is Hermes Agent? The self-improving AI agent from Nous Research](/blog/what-is-hermes-agent).
Part 3 is the OmniRoute deep dive: [What is OmniRoute? One endpoint for
290+ AI providers](/blog/what-is-omniroute).
Part 4 adds the memory layer: [What is Honcho? AI-native memory for your
self-hosted agent](/blog/what-is-honcho).*
