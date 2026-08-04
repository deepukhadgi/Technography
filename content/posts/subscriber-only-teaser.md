---
title: "Subscriber-Only: Inside My Self-Hosted AI Stack"
date: "2026-08-04"
excerpt: "What is actually running in the AI corner of my lab — models, gateways, memory, and the numbers behind it. This one is for subscribers."
tags: ["ai", "self-hosting", "homelab", "subscriber-only"]
premium: true
---

You have seen the posts about the individual pieces — the API gateway, the
agent runtime, the memory service. This post is where I dump the whole
picture: everything in my AI stack, what each piece actually does, why I run
it that way, and what it costs to keep the lights on.

## The shape of the stack

The stack is split into three layers: inference, routing, and memory. Each
layer runs in its own container, talks to its neighbors over the lab
network, and can be restarted, upgraded, or replaced without touching the
others.

The inference layer is the boring part — a couple of local models for the
tasks that need to stay private, and API access to cloud models for the
heavy lifting. The routing layer sits in front of both and decides where
each request goes based on the model name, the task type, and the current
load on the box. The memory layer keeps long-term context so the agent does
not forget what we talked about last week.

## Why subscriber-only

I have been asked a few times to write up the exact setup with real numbers
— token costs per month, model swap decisions, the mistakes I made when the
gateway first went in. That level of detail takes real time to put together,
so it lives here. Subscribers get the full breakdown; the public posts stay
focused on the how-to parts that help everyone.

I keep a living inventory of the whole setup in a file I update every time
something changes — `ai-stack-inventory.txt` in the lab notes repo. The
subscriber version of this post walks through it line by line: every
service, its container, its resource limits, and its monthly cost.

## What comes next

The next subscriber post will cover the security review I did on the whole
stack — which ports are exposed, what is behind the reverse proxy, and the
three changes that made the biggest difference. If you are not a subscriber
yet, logging in with a verified account unlocks everything above.
