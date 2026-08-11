---
title: "Umami vs Google Analytics: Why I Switched to Privacy-First Analytics"
date: "2026-08-08"
excerpt: "I ran Google Analytics for ten years, then ripped it out in one afternoon. Umami is self-hosted, cookieless, and GDPR-friendly — here is the comparison that convinced me, plus the exact Docker and nginx setup to run it yourself."
tags: ["analytics", "privacy", "umami", "self-hosting"]
---

I ran Google Analytics on every site I touched for about a decade. It
was the default, the safe choice, the thing every tutorial told you to
paste into your `<head>`. Then one afternoon I read what that script
actually does — cookies, fingerprinting, data shipped to third-party
advertising partners, a consent banner I had to build and maintain
myself — and I deleted it from this blog.

The replacement is **Umami**, a self-hosted, open-source analytics
engine that tracks visitors without a single cookie. This post is the
comparison I wish someone had written for me, plus the exact setup I
use: one Docker container, one Postgres database, one nginx location
block.

<figure>
  <img src="/images/umami-vs-google-analytics-diagram.png" alt="Umami vs Google Analytics: Why I Switched to Privacy-First Analytics architecture diagram" width="1200" height="600" loading="lazy" />
  <figcaption class="font-mono text-xs text-dim mt-2 text-center">Umami vs Google Analytics: Why I Switched to Privacy-First Analytics system diagram</figcaption>
</figure>
## Why I stopped trusting the free tier

"Free" analytics has a price, it's just not paid in dollars. Google
Analytics 4 is free up to about **10 million events per month**, but:

- **It needs consent.** GA4 relies on cookies and browser identifiers,
  so in the EU you must show a consent banner, wire up consent mode,
  and block scripts until the visitor opts in. Half your traffic
  silently drops out of your data.
- **It phones home.** The gtag.js bundle is tens of kilobytes (often
  north of 45 KB), and it spawns a swarm of extra requests to
  doubleclick.net and friends. Every pageview leaks referrer, device,
  and behavior data to third parties.
- **It builds a profile of people.** User-ID, cross-device stitching,
  advertising audiences — GA is engineered for ad targeting, not for
  telling you how many people read your post.

None of that is what a personal blog needs. A personal blog needs four
numbers: how many visitors, which pages, where they came from, and
whether the latest post flopped. Everything else is noise with a
GDPR bill attached.

## What Umami gives you instead

Umami is MIT-licensed, written in Node.js, and stores everything in a
Postgres database you own. The pitch:

- **Cookieless tracking.** The tracker is a single script of roughly
  **2 KB** that sends one tiny request per pageview. No cookies, no
  fingerprinting, no personal data — which means no consent banner in
  most EU cases, because there is nothing to consent to. (Check your
  own legal advice; the point is the data model is clean by design.)
- **First-party by default.** You serve the script from your own
  domain, behind your own nginx. Nothing leaves your infrastructure.
- **No telemetry.** Umami itself sends nothing home, and you can
  explicitly disable its own telemetry with an environment variable.
- **Real-time dashboards.** Visitors, pageviews, referrers, countries,
  devices — updated live, no "processing delay" of 24 hours.
- **Events API.** Want to track newsletter signups or outbound link
  clicks? `umami.track("signup", { plan: "free" })` — a few lines, no
  tag manager.
- **Tiny footprint.** A blog doing a few hundred pageviews a day sits
  comfortably under a gigabyte of Postgres storage for years. My
  single container idles at a few dozen megabytes of RAM.

Location data is derived from the request IP at the server and the raw
IP is not retained. That's the level of privacy engineering I want
from something bolted onto every page of my site.

## The setup: Docker + nginx

Run it on any host with Docker. I keep it on the same box as the
site, behind the same nginx, proxied under a path so the tracker URL
is first-party.

First, a `.env` file (this is the only file you really edit — the
official Umami repository ships a ready-made `docker-compose.yml` with
a Postgres 16 service pre-wired to the connection string format Umami
expects; set the database name and user to match, and leave the rest):

```bash
DATABASE_URL=postgresql://umami:<YOUR_DB_CREDENTIAL>@db:5432/umami
HASH_SALT=<32-byte-random-hex>
```

Generate the random salt the way you generate every other random
value in your life:

```bash
openssl rand -hex 32
```

Then the compose file — the app container is genuinely this small:

```yaml
services:
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:3000:3000"
```

Bind to the loopback interface only — nginx is the only thing that
should ever talk to it. Bring it up, grab the admin token from the
logs on first start, create your site, and copy the website ID it
gives you.

Now the nginx side. Serving the tracker from your own domain keeps
everything first-party, and proxying under a path means you never
expose a second port or subdomain:

```nginx
location /umami/ {
    proxy_pass http://umami:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`umami` is the container name on the internal Docker network — no
hostnames or ports to memorize. The trailing slash on `proxy_pass`
strips the `/umami/` prefix before forwarding, so the app sees clean
paths.

Then the tracker goes in your site's layout. This blog is Next.js, so
it uses the `Script` component, but a plain `<script>` tag works
anywhere:

```tsx
import Script from "next/script";

<Script
  src="https://<YOUR_DOMAIN>/umami/script.js"
  data-website-id="<YOUR_SITE_ID>"
  strategy="afterInteractive"
/>
```

That's the entire integration. Reload the page, and the dashboard
shows the hit within a second. No cookies were harmed.

## The honest comparison

After a month with both running side by side, here is what Umami does
**better**:

- **It respects people.** No consent banner, no third-party requests,
  no ad-tech pipes. This is the entire reason to switch.
- **It's fast.** A 2 KB first-party script vs a 45 KB+ bundle plus
  companion requests. On a phone over a bad connection, that's
  milliseconds of render blocking you get back.
- **It's yours.** All data, all the time, exportable, owned by you.
  If Umami's cloud goes away or you fork it, nothing is lost.
- **It's boring and reliable.** No A/B testing SDKs, no experiment
  frameworks, no surprise UI redesigns changing your event schema.

And what Google Analytics still does **better** — be honest about
this:

- **Deep funnels and path analysis.** Umami's reports are solid but
  shallower. If you run a marketing site with a real conversion
  funnel, GA4's exploration tools are stronger.
- **Cross-device identity.** Umami can't stitch a visitor's phone to
  their laptop, because it doesn't try. For content sites that's
  fine; for e-commerce it matters.
- **The ecosystem.** GA data feeds Google Ads, BigQuery exports, and a
  thousand dashboards. Umami's API is clean but the integration
  catalog is smaller.

My rule of thumb: **personal blog, content site, or small SaaS —
Umami. Ad-driven business or deep conversion analysis — GA4.**
There's also nothing wrong with running both: keep GA4 for a month to
validate that the numbers track each other within a few percent, then
cut the cord.

## The migration is one afternoon

Export what you care about (pageview counts by URL — Umami's import
tool handles GA exports), set up the container, swap the script tag,
delete the old one. I kept both running for a week, watched the
numbers converge, and then removed the old tag everywhere. The consent
banner came down the same day, and my pages got measurably lighter.

Six months in, I have never once wished for a Google Analytics
dashboard. What I have is a dashboard that loads instantly, tracks
without asking permission, and answers the only question I actually
ask it: *is anyone reading this?*
