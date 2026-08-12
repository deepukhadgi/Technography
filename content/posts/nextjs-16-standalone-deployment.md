---
title: "Next.js 16 Standalone Deployment: The Complete Guide"
date: "2026-08-12"
excerpt: "Deploy a Next.js 16 app as a standalone bundle behind nginx — no Node.js on the target server, full control over systemd, TLS, and performance."
tags: ["nextjs", "deployment", "nginx", "ubuntu"]
---

# Next.js 16 Standalone Deployment: The Complete Guide

If you've shipped a Next.js app to production before, you know the usual pain points: the server still needs a full Node.js install, environment variables leak between deployments, and restarting the app after an update is a fragile ritual.

The standalone output mode changes all of that. It bundles your entire application — including a minimal Node.js binary — into a self-contained directory that can run on a target machine with zero dependencies. Paired with nginx as a reverse proxy and a systemd service, you get a deployment that is fast, restartable, and easy to automate.

This guide walks through the complete pipeline: building standalone, configuring systemd, hardening nginx, and verifying the result.

## Why Standalone?

Before standalone existed, deploying Next.js meant:

1. Install Node.js on the target machine.
2. Copy the source or a tarball.
3. Run `npm install` (or `npm ci`).
4. Run `next build`.
5. Start the server with `node .next/standalone/server.js`.

Every step introduced a failure surface. A missing dependency, a Node.js version mismatch, or a stale `.next` cache could break the whole thing.

With standalone output, the build step produces a directory that already contains everything:

```
.next/standalone/
├── server.js
├── .next/
│   ├── server/          # compiled pages & APIs
│   └── static/          # client bundles
├── package.json         # dependency snapshot
└── public/              # static assets
```

The target machine only needs a compatible glibc — no package manager, no Node.js, no `npm install`.

## Prerequisites

- A Next.js 16 project with `output: 'standalone'` in `next.config.ts`
- An Ubuntu server (this guide uses 24.04 LTS)
- nginx installed
- A domain pointing to the server
- A systemd-capable init system (all modern Linux distros)

## Step 1: Enable Standalone Output

In `next.config.ts`, set the output field:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ... other config
};

export default nextConfig;
```

That's it. Next.js will now produce the standalone bundle during `next build`.

## Step 2: Build Locally

Run the build on your development machine:

```bash
npm run build
```

Verify the standalone directory exists:

```bash
ls .next/standalone/
```

You should see `server.js`, a `.next/` subdirectory, and `package.json`. If `package.json` is missing, `output: 'standalone'` may not be applied — double-check the config.

## Step 3: Transfer to the Server

Copy the entire standalone directory to the server. A simple rsync works:

```bash
rsync -avz --delete .next/standalone/ <YOUR_USERNAME>@<YOUR_HOST>:/opt/technography/
```

The `--delete` flag ensures stale files from previous deployments are removed.

## Step 4: Create the Systemd Service

Create `/etc/systemd/system/technography.service`:

```ini
[Unit]
Description=Technography Blog
After=network.target

[Service]
Type=simple
User=<YOUR_USERNAME>
Group=<YOUR_USERNAME>
WorkingDirectory=/opt/technography
Environment=NODE_ENV=production
Environment=PORT=3100
ExecStart=/opt/technography/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Key points:

- `WorkingDirectory` must point to the standalone root, **not** inside `.next/`.
- `ExecStart` runs `server.js` directly — no `node` command needed.
- `Restart=on-failure` with a 5-second delay prevents rapid crash loops.

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable technography
sudo systemctl start technography
sudo systemctl status technography
```

Check logs if anything looks wrong:

```bash
journalctl -u technography -f
```

## Step 5: Configure nginx

Create `/etc/nginx/sites-available/technography`:

```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <YOUR_DOMAIN>;

    ssl_certificate     /etc/letsencrypt/live/<YOUR_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<YOUR_DOMAIN>/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and test the config:

```bash
sudo ln -s /etc/nginx/sites-available/technography /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Handle Environment Variables

Environment variables for the standalone app are set in the systemd service file or via an `.env` file in the working directory. The deploy script on the real server handles this by copying `.env.local` separately — never commit that file to the repo.

For local development overrides, create `.env.local` in the project root. For production, the deploy pipeline injects them into the service environment.

A common pattern is to keep production secrets out of the repo entirely and inject them at deploy time:

```bash
# On the server, after rsync:
scp .env.local <YOUR_USERNAME>@<YOUR_HOST>:/opt/technography/.env.local
```

The standalone server reads `.env.local` automatically on startup.

## Step 7: Automate the Deployment

A minimal deploy script:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO=/home/<YOUR_USERNAME>/projects/Technography
REMOTE_USER=<YOUR_USERNAME>
REMOTE_HOST=<YOUR_HOST>
REMOTE_DIR=/opt/technography

cd "$REPO"
npm run build
rsync -avz --delete .next/standalone/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
ssh "${REMOTE_USER}@${REMOTE_HOST}" "systemctl restart technography"
```

Run it after every merge to `main`:

```bash
bash deploy.sh
```

## Verification Checklist

After deploying, verify each of these:

| Check | Command | Expected |
|-------|---------|----------|
| Service running | `systemctl status technography` | active (running) |
| nginx config | `nginx -t` | syntax ok |
| HTTPS | `curl -sI https://<YOUR_DOMAIN> | head -5` | 301 or 200 + `strict-transport-security` |
| App responds | `curl -s -o /dev/null -w "%{http_code}" https://<YOUR_DOMAIN>` | 200 |
| API routes | `curl -s https://<YOUR_DOMAIN>/api/health` | JSON response |

## Common Pitfalls

**Stale `.next` cache**: If you change route semantics (e.g., adding authentication checks), purge `.next/` before rebuilding:

```bash
rm -rf .next && npm run build
```

**`NODE_ENV` mismatch**: The standalone server respects `NODE_ENV`. If it's set to `development` in the service file, Next.js will skip code splitting and run in verbose mode. Always set `NODE_ENV=production`.

**Port conflicts**: The standalone server binds to the `PORT` environment variable. If another service is on that port, the app won't start. Check with `ss -tlnp | grep 3100`.

**Missing assets**: If static files return 404, verify the `public/` directory was included in the rsync. The standalone output copies `public/` automatically, but `--delete` on an empty destination can sometimes cause issues if the source and destination drift.

## What's Next?

Once the standalone pipeline is working, you can extend it with:

- **Zero-downtime deployments**: Run the new version on a temp port, verify, then swap the systemd `ExecStart` and reload.
- **Monitoring**: Add a health check endpoint and poll it with something like `cron` + `curl`.
- **Rollbacks**: Keep the previous `.next/standalone/` directory and switch back on failure.

The standalone output is the closest Next.js gets to a true "build once, run anywhere" model. With nginx handling TLS and systemd handling crashes, your blog or app runs reliably with minimal operational overhead.
