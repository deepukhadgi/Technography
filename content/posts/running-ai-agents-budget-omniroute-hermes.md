---
title: "Running AI Agents on a Budget: OmniRoute + Hermes Agent"
date: "2026-08-11"
excerpt: "How I run a personal AI agent 24/7 on a homelab VM using OmniRoute as a local AI gateway and Hermes Agent for task orchestration — all under $20/month in electricity."
tags: ["ai", "self-hosting", "omni", "hermes", "subscriber-only"]
premium: true
---

# Running AI Agents on a Budget: OmniRoute + Hermes Agent

Most people think running AI agents requires expensive cloud GPUs or monthly API bills. I run a personal AI agent on a 3 GB VM in my homelab for under a dollar a month in electricity. Here's exactly how.

## The Architecture

```
User (Telegram / CLI)
    ↓
Hermes Agent (task orchestration, tool calling)
    ↓
OmniRoute (local AI gateway — model routing, caching, prompt templating)
    ↓
Local GGUF models (llama.cpp inference on CPU)
```

The key insight: **OmniRoute** acts as a drop-in replacement for the OpenAI API. Hermes Agent talks to OmniRoute exactly like it would talk to OpenAI — same endpoints, same request format. OmniRoute then decides which local model to run, caches frequent completions, and handles prompt templates.

## Why This Stack?

**Hermes Agent** is an open-source personal AI agent framework. It gives you:
- Tool calling (browser automation, shell execution, file I/O)
- Multi-session memory
- Cron job scheduling
- Telegram integration for on-the-go commands

**OmniRoute** is a lightweight AI gateway that:
- Serves multiple GGUF models from a single endpoint
- Provides an OpenAI-compatible API
- Handles request routing and basic caching
- Runs entirely on CPU — no GPU required

Together they give you an AI assistant that can browse the web, execute commands, manage files, and schedule tasks — all self-hosted.

## Hardware Requirements

My setup runs on a Proxmox VM with:
- **2 vCPUs** (AMD EPYC, single-threaded performance matters more than core count for llama.cpp)
- **3 GB RAM** (enough for a 4-bit quantized 7B model)
- **20 GB disk** (model files + logs)

For a 7B model at 4-bit quantization, you need roughly 4-5 GB of RAM. If you're tight on memory, a 3B model runs comfortably in 2 GB.

## Step 1: Install OmniRoute

OmniRoute runs as a systemd service. On my setup:

```bash
# Clone the repo
git clone https://github.com/your-org/omniroute.git ~/omniroute
cd ~/omniroute

# Install dependencies
pip install -r requirements.txt

# Copy config
cp .env.example .env
```

Edit `.env`:

```ini
MODEL_PATH=/home/<YOUR_USERNAME>/models/llama-3.2-1b-instruct-Q4_K_M.gguf
MODEL_NAME=llama-3.2-1b
PORT=20128
MAX_CONTEXT=4096
```

Start the service:

```bash
sudo systemctl enable omniroute
sudo systemctl start omniroute
curl http://localhost:20128/v1/models
```

You should see your model listed.

## Step 2: Download a Model

I use **llama.cpp** to run GGUF models. For a budget setup, smaller models with good instruction-following are better than large models that OOM.

My current choice: **Llama 3.2 1B Instruct** (Q4_K_M quantization, ~1.2 GB). It's fast on CPU and surprisingly capable for task-oriented work.

Download from Hugging Face:

```bash
huggingface-cli download <model-repo> \
  --include "*.gguf" \
  --local-dir ~/models/
```

If you have more RAM, a 7B Q4 model will give noticeably better reasoning. The trade-off is latency — expect 5-15 seconds per response on a 2 vCPU VM.

## Step 3: Configure Hermes Agent

Hermes Agent reads its config from `~/.hermes/config.yaml`. The critical section for OmniRoute integration:

```yaml
model:
  provider: custom
  api_base: http://127.0.0.1:20128/v1
  api_key: omni-route  # arbitrary, OmniRoute doesn't auth
  model_name: llama-3.2-1b
```

This tells Hermes to send all LLM requests to OmniRoute instead of a cloud API. From Hermes' perspective, it's just another OpenAI-compatible endpoint.

## Step 4: Wire Up Tools

Hermes Agent's power comes from its tool ecosystem. The default tools include:
- `web_search` — web lookup via search engine
- `web_extract` — fetch and parse web pages
- `browser_use` — headless browser automation
- `computer_use` — drive your desktop GUI
- `terminal` — execute shell commands
- `delegate_task` — spawn subagents for parallel work

Configure tools in `~/.hermes/config.yaml`:

```yaml
tools:
  browser:
    enabled: true
    headless: true
  terminal:
    enabled: true
    workdir: /home/<YOUR_USERNAME>/projects
  web:
    enabled: true
    engine: searxng  # self-hosted or public instance
```

## Step 5: Set Up Telegram Integration

Hermes supports Telegram as a messaging frontend. This lets you chat with your agent from your phone.

Create a bot via @BotFather on Telegram, then add to config:

```yaml
telegram:
  bot_token: "<YOUR_BOT_TOKEN>"
  chat_id: "<YOUR_CHAT_ID>"
  enabled: true
```

The agent will respond to messages in your chat and can push notifications for completed tasks.

## Step 6: Schedule Tasks with Cron

One of Hermes' best features is built-in cron job support. I use it for daily blog publishing, system checks, and automated research.

Example: publish blog posts every morning at 9 AM:

```bash
hermes cron create "daily-blog-publish" \
  --schedule "0 9 * * *" \
  --prompt "Check the topic queue in ~/projects/Technography and publish any pending posts."
```

The agent will wake up, check the queue, write and deploy posts, and notify you via Telegram when done.

## Cost Breakdown

| Component | Cost |
|-----------|------|
| Proxmox VM (2 vCPU, 3 GB RAM) | ~$0.80/month electricity |
| OmniRoute (self-hosted) | $0 |
| Hermes Agent (self-hosted) | $0 |
| Models (GGUF, downloaded once) | $0 |
| **Total** | **~$0.80/month** |

Compare that to cloud alternatives: an OpenAI API subscription for equivalent usage runs $20-50/month, and a cloud VM with GPU inference starts at $100+/month.

## Limitations to Know

- **Latency**: CPU inference is slower than GPU. Expect 3-10 seconds per token for a 7B model.
- **Context window**: Smaller models have shorter context (4K-8K tokens). Long conversations may lose track of earlier messages.
- **No vision**: Most GGUF models are text-only. If you need image understanding, you'll need a multimodal model (larger, more RAM) or a hybrid approach.
- **Single model**: OmniRoute serves one model at a time. For multi-model routing, you'd need a more complex setup.

Despite these, the stack is incredibly capable for daily automation, research assistance, and personal productivity tasks.

## Final Thoughts

Self-hosted AI used to mean expensive GPUs and complex Kubernetes clusters. With modern GGUF quantization and lightweight gateways like OmniRoute, you can run a capable AI agent on hardware that costs less than a cup of coffee per month.

The trade-off is patience — CPU inference is slower, and you need to size your model to your RAM. But for task-oriented agents that do research, automate workflows, and manage projects, the performance is more than adequate.
