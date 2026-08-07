---
title: "Deploying Listmonk: Self-Hosted Newsletter in 5 Commands"
date: "2026-08-07"
excerpt: "Mailchimp pricing is a nightmare once your list grows. Listmonk is a fast, self-hosted, single-binary newsletter tool with a real API — and you can be sending your first campaign in about five commands."
tags: ["self-hosting", "docker", "newsletter", "listmonk"]
---

Newsletters have a cost problem. The moment your subscriber list grows
past a few thousand people, the hosted platforms start charging a
small fortune for what is, at its core, a templated email and a list of
addresses. I ran the numbers on my own list, did the math on the
per-subscriber pricing tiers, and decided the monthly fee was better
spent on a cheap VPS and a few hours of setup.

Enter **Listmonk**: a fast, self-hosted newsletter and mailing list
manager written in Go. One binary, a Postgres database, no JavaScript
framework bloat in the admin panel, and an HTTP API that makes it
trivial to plug into an existing blog or app. It is the closest thing
to a drop-in Mailchimp replacement that actually respects your data.

## Why Listmonk?

Before picking it I evaluated the usual suspects. The reasons Listmonk
won:

1. **It is genuinely fast.** The admin UI is server-rendered with no
   heavy client-side framework. Sending thousands of emails is handled
   by a batch worker with configurable throughput — no cron hacks.
2. **One binary, one database.** There is no Redis, no queue broker, no
   second app server. Just `listmonk` and Postgres. That is the entire
   state of the world.
3. **A real API.** Subscribing, unsubscribing, importing, and sending
   are all available over HTTP with a token. This is what lets me
   auto-subscribe blog readers from my own backend.
4. **Import from everything.** CSV, Mailchimp, Mailgun, Sendy exports —
   migration is a single import screen.
5. **MIT licensed.** No feature-gated tiers, no "Pro" upgrade nagging.

If you are self-hosting anything else — a blog, an app, a homelab —
this fits right in.

## Step 1 — The Compose file

Listmonk's official Docker image bundles the binary and its config
tool. Pair it with a Postgres container and you have a full stack in
one file:

```yaml
services:
  listmonk:
    image: listmonk/listmonk:latest
    restart: unless-stopped
    ports:
      - "9000:9000"
    environment:
      - TZ=UTC
    volumes:
      - ./config.toml:/listmonk/config.toml:ro
      - ./uploads:/listmonk/uploads
    depends_on:
      - db
    networks:
      - newsletter

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: listmonk
      POSTGRES_USER: listmonk
      POSTGRES_PASSWORD: <CHANGE_ME_STRONG_PASSWORD>
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - newsletter

volumes:
  pgdata:

networks:
  newsletter:
```

Two notes from experience:

- Mount `config.toml` **read-only**. Listmonk only writes it during
  first-time setup; keeping it `:ro` in production stops accidental
  edits from a stray command.
- Give Postgres its own named volume. Losing a newsletter database —
  subscribers, templates, campaign history — is not something you want
  to rebuild by hand.

## Step 2 — Generate the config

Listmonk ships a helper that writes a complete, commented
`config.toml`. Generate it once, then fill in the database settings:

```bash
docker compose run --rm listmonk ./listmonk --new-config
```

The generated file contains every option with defaults, which is the
best documentation Listmonk has. The critical block is the database
connection and the app URL:

```toml
[app]
address = "0.0.0.0:9000"
admin_username = "<YOUR_ADMIN_USER>"
admin_password = "<CHANGE_ME_STRONG_PASSWORD>"

[db]
host = "db"
port = 5432
database = "listmonk"
user = "listmonk"
password = "<CHANGE_ME_STRONG_PASSWORD>"
ssl_mode = "disable"
max_open = 25
max_idle = 25
max_lifetime = "300s"
```

Because the app container reaches Postgres over the Docker network, the
`host` is the service name `db`, not an IP address. Get this wrong and
you will see `connection refused` immediately — everything else in
Listmonk is surprisingly forgiving.

## Step 3 — Create the admin and schema

With the config in place, start the stack and run the installer:

```bash
docker compose up -d
docker compose run --rm listmonk ./listmonk --install --yes
```

The `--install` flag creates the database schema, the admin account
(from `config.toml`), and a set of demo templates and campaigns so you
can click around before building anything real. `--yes` skips the
interactive prompts — useful when you are scripting this.

If you ever want to start completely clean, the same command with
`--yes` on a fresh database does the whole bootstrap in one go. There
is also a `--idempotent` flag for re-running migrations safely on an
existing database, which is what you will use after every upgrade.

## Step 4 — Wire up SMTP

A newsletter that cannot send mail is a contacts app. Listmonk does
not include an MTA — it hands messages to an SMTP relay. I use a
transactional email provider, which means the config is three lines:

```toml
[smtp]
host = "smtp.<YOUR_PROVIDER>.com"
port = 587
auth_user = "<YOUR_SMTP_USER>"
auth_password = "<YOUR_SMTP_PASSWORD>"
from_email = "newsletter@<YOUR_DOMAIN>"
```

Two things that will save you a support ticket:

- **Use port 587 with STARTTLS**, not port 25. Port 25 is blocked by
  most VPS providers to fight spam, and 465 implicit-TLS is
  unnecessarily finicky behind reverse proxies.
- **Verify the from-domain.** Your provider will want you to add SPF
  and DKIM records for `<YOUR_DOMAIN>` pointing at their sending
  infrastructure. Until those records propagate, your newsletters land
  in spam folders regardless of how good the copy is.

Listmonk has a "Send test email" button right on the SMTP settings
page. Use it. The error message it shows you is far more useful than
digging through container logs.

## Step 5 — Put it behind nginx with TLS

The admin panel listens on port 9000 — do not expose that raw port to
the internet. A reverse proxy with TLS is five lines in an nginx
server block:

```nginx
server {
    listen 443 ssl http2;
    server_name newsletter.<YOUR_DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then get a certificate:

```bash
sudo certbot --nginx -d newsletter.<YOUR_DOMAIN>
```

If you use Cloudflare in front, you can go one step further: generate
an Origin certificate, configure nginx to present it, and set the
Cloudflare proxy to Full (Strict). That way the only thing touching
your origin is Cloudflare's edge, and every hop is TLS.

## Importing subscribers and sending

With the stack live, the workflow is:

1. **Import** — the admin panel takes CSV or pasted lists, with
   automatic duplicate detection against the whole list.
2. **Create a list** — e.g. "blog updates". Subscribers can belong to
   many lists, and campaigns target lists.
3. **Build a template** — Listmonk uses Go `text/template` with
   `{{.Name}}`, `{{.UnsubscribeURL}}`, and friends. The demo templates
   are a great starting point.
4. **Send a campaign** — scheduled or immediate, with a per-batch
   concurrency setting so you do not trip your SMTP provider's rate
   limits.

Double opt-in is built in: enable it per-list and new subscribers get a
confirmation email with a signed confirmation link. The unsubscribe
link is included in every campaign automatically via the template
variable, and bounces are recorded per-subscriber so you can prune dead
addresses.

## Keeping it safe and healthy

- **Lock down the admin panel.** At minimum, restrict access to your
  home IP in the firewall rules, or put basic auth in front of it.
  Listmonk also supports TOTP two-factor for admin accounts — enable
  it.
- **Back up Postgres.** `pg_dump` the `listmonk` database nightly and
  ship it off-box. Subscriber lists are the crown jewels of a
  newsletter operation.
- **Watch the send queue.** Under `Settings → SMTP` there is a batching
  setting (`max_batch_size`) that controls how many messages Listmonk
  pushes per batch. If your relay rate-limits you, lower it and let the
  campaign take a little longer.
- **Upgrade deliberately.** Listmonk releases are frequent. Read the
  changelog, back up, run `--install --idempotent`, and test a single
  campaign before trusting a new version with a scheduled blast.

## The verdict

Five commands, one compose file, and a few DNS records was the entire
migration. My monthly newsletter cost went from a per-subscriber SaaS
bill to the price of a Postgres container on a box I already pay for —
and I got an API, full data ownership, and an admin panel that loads in
under a second, all for the same money. If your list is bigger than
your patience for vendor pricing, Listmonk is the answer.
