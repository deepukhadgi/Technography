---
title: "Deploying this site: Next.js + nginx on a self-hosted server"
date: "2026-08-01"
excerpt: "The exact deployment setup behind a self-hosted Next.js blog — standalone build, systemd, and nginx as reverse proxy."
tags: ["nginx", "nextjs", "deployment", "self-hosting"]
---

This website runs on a small VM in my home lab. Here's the full stack and
how it's wired together — the same setup you can use for any Node.js app.

## The stack

| piece    | choice                |
| -------- | --------------------- |
| runtime  | Node.js (LTS)         |
| app      | Next.js, standalone output |
| server   | nginx (reverse proxy) |
| process  | systemd service       |
| TLS      | Let's Encrypt (pending DNS) |

## Why standalone output

Next.js has an output mode called `standalone` that creates a minimal
production build — a single `server.js` plus just the `node_modules` the
app actually needs. Instead of a multi-gigabyte deployment, the server
folder is tens of megabytes. You don't even need the Next CLI installed on
the server; plain `node server.js` is enough.

In `next.config.ts`:

```ts
const nextConfig = {
  output: "standalone",
};
```

After `npm run build`, the server lives in `.next/standalone`.

## Deploying

The build happens on my workstation; the result is copied to the server.
Two things have to follow the standalone server: the `public/` folder and
`.next/static` (the standalone build doesn't copy them automatically).

On the server, the app runs as a systemd service:

```ini
[Unit]
Description=Technography Next.js app
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/technography
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

It listens on `127.0.0.1:3000` — never exposed directly to the internet.

## nginx in front

nginx terminates the outside traffic and proxies to the app:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

That `X-Forwarded-*` pair matters — the app needs to know it's being served
over the proxy or links and redirects break.

## Why nginx at all if Node can serve HTTP?

A few reasons:

- nginx is battle-tested at the edge and handles slow clients gracefully
- it's where TLS terminates once the certificate is issued (no app changes)
- it can serve static assets, gzip, and cache headers without the app
  thinking about it
- future services can join behind the same nginx with their own `server {}`

## Next steps

Once DNS for the domain is fully propagated, the next step is TLS with
Let's Encrypt — `certbot --nginx` makes it almost too easy. Then the whole
site runs over HTTPS and the browser gets a green lock.

That's the whole pipeline: build once, copy, systemd keeps it alive, nginx
fronts it. Nothing fancy, nothing fragile — exactly how production should
feel.
