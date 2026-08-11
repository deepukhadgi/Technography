---
title: "Cloudflare Email Routing: Free Email for Your Domain"
date: "2026-08-10"
excerpt: "Professional email addresses for your domain with zero servers, zero storage, and zero cost. Cloudflare Email Routing forwards inbound mail to any inbox — and handles MX and SPF for you."
tags: ["cloudflare", "email", "dns", "setup", "subscriber-only"]
premium: true
---

The moment you register a domain, you face the email problem. You want `contact@<YOUR_DOMAIN>`, `admin@<YOUR_DOMAIN>`, and a way for services to reach you — but the obvious answers all cost something. Google Workspace bills per seat per month. A self-hosted mail stack works (see the sibling post *Postfix + OpenDKIM: Self-Hosted Mail Server That Actually Works*), but it is real maintenance: a server to patch, a mailbox to back up, an IP reputation to nurse.

Cloudflare Email Routing solves the inbound half for exactly zero dollars. This post walks through how it works, the exact setup steps, and the DNS machinery behind it — plus the behind-the-scenes details I check on my own domain.

## What it is — and what it is not

Email Routing is a **forwarding-only** service. Mail sent to `anything@<YOUR_DOMAIN>` arrives at Cloudflare's mail edge, and gets forwarded verbatim to a destination inbox you choose — typically your existing Gmail, Proton, or work inbox.

- ✅ It **receives** mail for your domain.
- ✅ It **forwards** it to a verified destination address.
- ✅ It **manages your MX and SPF records** automatically.
- ❌ It does **not send** mail — there is no SMTP server, no outbound interface.
- ❌ It does **not store** mail — no mailbox, no IMAP, nothing to back up.

That last point is the security gift that keeps giving: there is no mailbox on your infrastructure for an attacker to find, and no storage quota to manage. The attack surface is Cloudflare's, not yours.

## The numbers that matter

On the free plan, per domain:

- **Up to 200 custom addresses** (routing rules) — `hello@`, `security@`, `newsletter@`, one per service if you want.
- **Up to 200 verified destination addresses** — each one is an inbox you've proven you own.
- **1 catch-all rule** — everything else, sent anywhere or dropped.
- **No per-message forwarding quota** — routing to verified destinations does not count against any daily or monthly limit.

Compare that with a per-seat mailbox plan and the math is not close: 200 addresses is a lot of professional email for free.

## How the routing actually works

Under the hood it is a simple chain:

```
sender → MX lookup → Cloudflare mail edge → your routing rules → destination inbox
```

Three pieces make this reliable enough to trust with real mail:

**1. MX failover.** Cloudflare points your domain at its mail edge with multiple MX records at staggered priorities. If one edge host is unreachable, the sender's mail server retries the next. Mail delivery has never depended on a single box.

**2. SRS (Sender Rewriting Scheme).** Here is the clever bit: when a message is forwarded, the envelope sender is rewritten so the final destination's SPF check passes. Without SRS, a forward from `newsletter@<YOUR_DOMAIN>` to your Gmail would arrive with an SPF *fail*, because the original sender's domain never authorized Cloudflare to relay it. SRS rewrites the envelope — while leaving the message body untouched.

**3. DKIM preservation.** Because forwarding is verbatim, the original sender's DKIM signature survives intact. Recipients who check DKIM still see a valid signature from the real sender. Forwarding is transparent to authentication, which is exactly what you want from a pipe.

## Setup: five minutes, one verification click

**Prerequisite:** the domain must be on Cloudflare DNS (free plan is fine). If your nameservers are still at your registrar, move them first — Email Routing lives inside the zone.

**Step 1 — Enable the feature.** In the dashboard, open your zone → *Email* → *Email Routing* → *Get started*. Cloudflare immediately tells you which DNS records it wants to add.

**Step 2 — Verify a destination.** Add your real inbox (e.g. `<YOUR_USERNAME>@gmail.com`) as a destination address. Cloudflare sends a verification email to it; click the link inside. Mail will not flow to an unverified address — this is the anti-hijack guarantee, so an attacker cannot point your domain's mail at their own inbox without mailbox access.

**Step 3 — Create routing rules.** Map addresses to destinations:

| Custom address | Action |
|---|---|
| `hello@<YOUR_DOMAIN>` | Forward to your inbox |
| `admin@<YOUR_DOMAIN>` | Forward to your inbox |
| `security@<YOUR_DOMAIN>` | Forward to your inbox |
| Catch-all (`*`) | Send to your inbox — or **Drop** |

For the catch-all, I recommend *Send to* while you are getting started (you will discover which services leak which aliases), then tighten to *Drop* if spam volume warrants. Each rule is independent, so `security@` can go to a different destination than `hello@` if you like.

**Step 4 — Let it write the DNS.** Enabling Email Routing adds and **locks** the required records: the MX records pointing at Cloudflare's mail edge, and an SPF record so your domain has a defined mail policy. "Locked" means the dashboard refuses to let you delete them while routing is enabled — a genuinely thoughtful guardrail against "I was just cleaning up DNS" outages.

You can confirm what it wrote from a terminal:

```bash
dig +short MX <YOUR_DOMAIN>
dig +short TXT <YOUR_DOMAIN> | grep spf
```

## Behind the scenes: what my domain's records look like

Subscriber privilege: here is the live DNS layout of this blog's domain, which you can verify yourself in seconds. `dig +short MX deepukhadgi.com.np` returns **three** MX records — `linda`, `isaac`, and `amir` at `*.mx.cloudflare.net` — each at a different priority, so inbound mail has three independent paths. The SPF record is a single string including both Cloudflare's inbound include (`_spf.mx.cloudflare.net`) and the outbound relay's include — because Email Routing only receives, the *sending* half of the domain is signed by the transactional relay that powers the blog's notifications, with DKIM keys published under `mail._domainkey`. A DMARC policy of `p=quarantine` tells recipients what to do with mail that fails authentication, and the report address is a monitored mailbox.

That three-record layout is the pattern worth copying: **separate inbound (Cloudflare) and outbound (relay) paths, each with its own SPF include, all covered by one DMARC policy.** Sending and receiving are independent jobs, and your DNS should say so.

## Patterns I actually use

- **Alias-per-service.** Every service gets its own address — `newsletter@`, `billing@`, `github@`. If one leaks and spam arrives, you know exactly which vendor sold you out, and deleting one rule kills the flow.
- **Catch-all to a filtered inbox.** Everything lands in one inbox with a label/filter. Nothing gets lost because someone typed `support@` instead of `hello@`.
- **Disposable on demand.** Need to sign up for a trial? Create an address, verify, use it, delete it. No server, no waiting.
- **Postmaster hygiene.** Add a `postmaster@<YOUR_DOMAIN>` rule so the internet's mail operators can reach you — it is expected by convention and checked by automated tools.

## One honest limitation

Email Routing will never send a message, so you still need an outbound path the day your domain wants to send anything — a transactional relay with DKIM signing (the sibling post covers exactly that setup). But for inbound, it is the best free deal in DNS: professional addresses, no servers, no storage, no bill.

## Verification cheat sheet

```bash
# MX present and pointing at Cloudflare
dig +short MX <YOUR_DOMAIN>

# SPF includes Cloudflare's include
dig +short TXT <YOUR_DOMAIN> | grep spf

# DMARC policy published
dig +short TXT _dmarc.<YOUR_DOMAIN>
```

Forward a test message to any address you created, confirm it lands in the destination inbox, and you are done — free professional email for your domain, forever.
