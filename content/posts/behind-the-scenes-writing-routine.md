---
title: "Behind the Scenes: How I Write Two Blog Posts Every Single Day"
date: "2026-08-18"
excerpt: "An inside look at the automated pipeline that powers this blog, from topic selection to daily publishing."
tags: ["automation", "blog", "workflow", "hermes", "subscriber-only"]
premium: true
---

# Behind the Scenes: How I Write Two Blog Posts Every Single Day

If you've been following the blog, you might have noticed the consistent, daily output. It’s not humanly possible for me to manually draft, edit, build, and deploy high-quality technical content twice a day while running a full homelab.

The secret? **Total Automation.**

In this subscriber-only deep dive, I'm peeling back the curtain on the pipeline that makes this possible.

## The Pipeline

My publishing process is a fully automated system driven by a custom-configured instance of the Hermes Agent.

### 1. The Topic Queue
Everything starts with `content/topics.md`. This isn't just a list; it's the brain of the blog. It tracks the status of potential posts (pending, drafted, published) and classifies them as public or subscriber-only.

### 2. The Cron-Driven Agent
The real magic happens on a schedule. A cron job fires off the `technography-workflow` skill. This script:
*   Queries the topic queue.
*   Picks pending items.
*   Spawns agents to draft, edit, and sanitize the content.
*   Performs a security scan (crucial to ensure no internal <YOUR_HOST> details leak into public posts).

### 3. The Build & Deploy
Once the posts are drafted, the agent kicks off a build (`npm run build`) within the <YOUR_SERVER> environment. If the build passes, the standalone server output is shipped to the web server, and the site restarts.

## Why This Works

It removes the barrier of "finding time." By offloading the mechanical steps—formatting, building, deploying—I can focus entirely on the technical substance of the post.

The agent handles the tedious parts:
*   Sanitizing the content to remove internal infrastructure details.
*   Enforcing the frontmatter format.
*   Handling the GitHub issue tracking automatically.
*   Verifying live HTTP 200 codes.

## The Lessons

Building this wasn't easy. I had to learn the hard way about:
*   **Next.js 16 breaking changes:** Prerendering leaks and `force-dynamic` constraints.
*   **Security:** Never trusting the automation to catch secrets. The automated `grep` scan is a fail-safe, not the primary defense.
*   **Robustness:** If one part of the build fails, the deploy stops immediately. It’s better to have a slightly delayed post than a broken production site.

This pipeline is my most valuable productivity asset. It gives me the freedom to document my homelab journey without the overhead.
