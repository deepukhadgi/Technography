---
title: "Zero-Downtime Deployments with Docker and Nginx"
date: "2026-08-22"
excerpt: "Stop throwing 502s at your users every time you ship. Here is how to roll out container updates behind Nginx with zero dropped requests, using nothing but Docker, a healthcheck, and a blue-green pattern you can script in 20 lines."
tags: ["deployment", "docker", "nginx", "zero-downtime"]
---

There is a moment every self-hoster remembers: you push an update, refresh the tab, and get a cold `502 Bad Gateway` for three seconds while the container boots. Multiply that by every visitor and every deploy, and you have quietly built a service that is "down" for a few seconds several times a week.

Zero-downtime deployment is not a Kubernetes-only luxury. With plain Docker and Nginx you can ship updates that never drop a single request. This guide walks through the pattern, the config, and the one healthcheck you must get right.

## Why deploys cause downtime

A naive deploy looks like this:

```bash
docker compose down
docker compose up -d
```

The problem is the gap between `down` finishing and the new container being **ready to serve traffic**. Nginx keeps its upstream socket open, the container stops, and for a window of 500ms–10s every request hits a dead backend. Nginx returns `502` until the new container is up and the proxy reconnects.

There are three moving parts that, if any one fails, breaks the streak:

1. The container must come up **before** the old one leaves.
2. Nginx must only route to a backend that has passed a healthcheck.
3. Nginx itself must reload its config without dropping connections.

## Pattern 1: Blue-green with two containers

The simplest robust approach is to run two copies of your app on different container names and ports, and flip Nginx between them.

```yaml
# docker-compose.bluegreen.yml
services:
  app_blue:
    image: myapp:1.0.0
    expose:
      - "3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 15s

  app_green:
    image: myapp:1.1.0
    expose:
      - "3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 15s
```

The `start_period: 15s` is the critical knob. It tells Docker to wait 15 seconds after start before counting failed healthchecks against the container. Without it, a slow boot gets marked unhealthy before the app is even listening.

Nginx points at whichever color is "live":

```nginx
upstream app_live {
    server 127.0.0.1:3000;   # blue
    # server 127.0.0.1:3001; # green (swap this line on deploy)
}

server {
    listen 80;
    server_name <YOUR_DOMAIN>;

    location / {
        proxy_pass http://app_live;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

On deploy you build the new color, wait for its healthcheck to go green, then swap the `upstream` server line and `nginx -s reload`. Because the old container keeps running until you stop it, in-flight requests finish cleanly.

## Pattern 2: Nginx reload is already seamless

A lot of people reach for complex service discovery when they don't need to. `nginx -s reload` (or `kill -HUP $(cat /var/run/nginx.pid)`) does a **graceful reload**: the old worker processes keep serving existing connections while new workers pick up the new config. No dropped sockets, no `502`.

The only requirement is that you never `restart` Nginx during a deploy — `reload` only.

## Pattern 3: The single-container "start first" trick

If you only run one instance (common for small homelab services), the downtime comes purely from `down` then `up`. Flip the order:

```bash
# Build and start the new image while the old one still serves
docker compose up -d --no-deps --build app

# Nginx upstream already points at the container name "app" via Docker network DNS,
# so the new container takes over the name once healthy.
```

Docker Compose's default behavior is to create the new container, wait for it to be healthy (if you set `depends_on: condition: service_healthy` elsewhere), and only then stop the old one. Combined with `healthcheck`, this gives you a clean handoff even with a single container name.

## The healthcheck is the whole game

Everything above hinges on one thing: Nginx must not send traffic to a backend that isn't ready. Two ways to enforce it:

**Option A — Docker healthcheck + Nginx `max_fails` + `proxy_next_upstream`:**

```nginx
upstream app {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
}
```

With `proxy_next_upstream error timeout http_502 http_503;`, Nginx will retry the next healthy backend automatically instead of returning an error to the user.

**Option B — an external gate in your deploy script.** Before you flip the upstream, poll the health endpoint:

```bash
until curl -sf http://127.0.0.1:3001/healthz; do
  echo "waiting for new container..."
  sleep 2
done
echo "healthy — flipping upstream"
```

This guarantees you never point Nginx at a cold backend.

## Wiring it into a deploy script

Here is the 20-line version that ties it together:

```bash
#!/usr/bin/env bash
set -euo pipefail

NEW_TAG="${1:-latest}"
DEPLOY_PORT=3001   # the "incoming" color

# 1. Pull/build and start the new container on the inactive port
docker compose up -d --build --scale app_incoming=1

# 2. Block until it is healthy
until curl -sf "http://127.0.0.1:${DEPLOY_PORT}/healthz"; do
  sleep 2
done

# 3. Swap the upstream in the Nginx config (idempotent sed)
sed -i "s/server 127.0.0.1:[0-9]\\+;/server 127.0.0.1:${DEPLOY_PORT};/" /etc/nginx/conf.d/app.conf

# 4. Graceful reload — no dropped connections
nginx -t && nginx -s reload

# 5. Stop the old container once traffic has drained
docker compose stop app_outgoing || true
```

Run it as `./deploy.sh 1.2.0` and your users never see a blip.

## What I actually run

For my own stack I keep it pragmatic: a single Nginx reverse proxy in front of all services, each app container with a `curl`-based healthcheck, and deploys that `up -d --build` before any config flip. The standalone Next.js build I ship gets the same treatment — build artifacts land, the old process keeps serving until the new one is listening on its port, then a `reload` hands off. Total visible downtime: zero, measured across dozens of deploys.

## Takeaways

- Never `docker compose down` then `up` in a user-facing path.
- `nginx -s reload` is graceful — use it, don't `restart`.
- The healthcheck (`start_period` included) is what makes the handoff real.
- A 20-line script with a `curl` gate beats elaborate orchestration for 90% of homelab and small-production needs.

Ship often, ship safely.
