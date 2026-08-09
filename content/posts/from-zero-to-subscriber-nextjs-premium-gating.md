---
title: "From Zero to Subscriber: Building Auth + Premium Gating in Next.js"
date: "2026-08-09"
excerpt: "How this blog's subscriber system works end to end: signed session cookies, a Postgres-backed session store, email verification, TOTP, and request-time premium gating in Next.js 16 — including the force-dynamic gotcha that bit me."
tags: ["nextjs", "auth", "premium", "javascript", "subscriber-only"]
premium: true
---

You've probably seen the lock. A post on this site shows a teaser and a
"log in to read" button until you sign in — then the full article
renders. From the outside it looks like a trivial feature. Inside, it
touches almost every part of the stack: a signed cookie, a database,
email verification, rate limiting, and one of the nastiest Next.js 16
gotchas I've hit.

## The requirements

Before writing any code, I wrote down what the gate had to do:

- The premium post body must **never reach a logged-out browser** —
  hiding it in the client bundle isn't gating, it's a teaser with extra
  steps.
- The check has to run **on every request**, because "subscriber" is a
  property of the session, not of the page.
- Sessions must be revocable (log out everywhere, kick a compromised
  session) and expire on their own.
- One function should decide "is this person a subscriber?" so that a
  future paid tier changes exactly one place.

## Decision one: session architecture

A JWT in a cookie is the classic choice — stateless, no database lookup.
I didn't pick it, for one reason: revocation. If a session is
compromised, you want to kill it *now*, not wait for it to expire.

So the design is an **opaque session token stored in Postgres**, with
the cookie carrying only that token, HMAC-signed so it can't be tampered
with:

- Signup or login creates a random 32-byte token, inserts it into a
  `sessions` table with an expiry, and sets a cookie containing the
  token plus an HMAC-SHA256 signature computed with a server-side
  signing key.
- Every authenticated request looks the token up in the database,
  checks expiry, and touches `last_activity_at`.
- Logout deletes the row. Compromised session? Delete the row. Done.

The cookie is `httpOnly`, `secure` in production, `sameSite: lax` —
JavaScript can't read it, it only travels over HTTPS, and it still rides
along on top-level navigations. The signing key lives in a server-side
environment variable, nowhere else.

## Decision two: idle timeout, not just expiry

Absolute expiry (30 days) is the easy part. The **idle timeout**
surprised me more. Every authenticated request checks `last_activity_at`;
idle for more than 30 minutes, the session is deleted on the spot — a
laptop left signed in for a week isn't a live session waiting to be
stolen. And because the timeout check and the `UPDATE` happen on the
same request, the session slides forward as you use it — no forced
re-logins.

That one extra column plus a comparison is the whole trick. It turned
"sessions last a month" into "sessions last a month *of actual use*."

## The login endpoint

The login route is where the details pile up:

- **bcrypt verification** with a per-user salt — never plaintext,
  never reversible. `bcryptjs` for the compare.
- **A dummy hash on unknown accounts.** If the email isn't in the
  database, the code still runs `bcrypt.compare` against a fixed dummy
  hash, so a missing account and a wrong credential take the *same
  amount of time*. Without this, an attacker can enumerate accounts by
  timing alone.
- **Rate limiting**: 10 attempts per IP per 15 minutes; past that, the
  API answers 429 with a `Retry-After` header. Brute force is already
  hopeless against a strong credential; rate limiting makes it
  pointless.
- **A generic error.** One message for both failure modes, so the
  response itself never leaks which one was wrong.
- **Email verification is enforced at login.** Unverified accounts
  can't get a session, which is what makes the subscriber definition
  honest (more below).

## Signup: the bot gauntlet

Registration has its own set of traps. The route validates email format
and length, hashes the credential with bcrypt, and — before anything
else — checks a **honeypot field**: an invisible form input that humans
never fill. Bots fill everything; when the honeypot has content, the API
returns a fake success and stores nothing.

Then a verification email goes out with a short-lived token. The account
exists but can't log in until the email is confirmed. That one step
kills three problems at once: fake signups with someone else's email,
typo'd addresses, and the "I'll sign up as whoever to read the premium
post" attack — because you can't read anything until you prove you own
the inbox.

## Two-factor, because it's free to add

TOTP (the same algorithm your authenticator app uses) is wired into the
settings page: generate a TOTP key, show a QR code, require one
verification code before enabling. After that, login demands a current
code from the app. The codes are compared in constant time, and the TOTP
key is stored per-user, encrypted at rest.

For a one-person blog this is arguably overkill — but retrofitting it
once accounts exist is far costlier, and the account database is the
crown jewels of a site with a paid tier.

## The gate: one function, one line

The actual premium check is deliberately boring:

```ts
export async function isSubscriber(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
```

Right now, "subscriber" means "verified, logged-in user." When a real
paid tier lands, this ONE function changes — look up a subscription for
`session.userId` — and every gated page picks it up automatically.

The page uses it like this:

```tsx
const subscriber = post.premium ? await isSubscriber() : true;
```

If `subscriber` is true, the server renders the full markdown. If not,
it renders the lockbox — excerpt, "log in to read" button, nothing
else. The premium body is a server-side string that never becomes HTML
for a logged-out visitor: the content isn't hidden with CSS, it's never
sent.

## The Next.js 16 gotcha that cost me an evening

This site is on Next.js 16 with the App Router. The blog route reads
cookies via `next/headers` — and during **on-demand static generation**,
calling `cookies()` throws `DYNAMIC_SERVER_USAGE`. The framework is
telling you: you can't read request headers while prerendering a page
that will be served to everyone.

The fix is exactly one line in the post page:

```ts
export const dynamic = "force-dynamic";
```

That skips build-time prerendering for the route entirely. Every request
renders fresh, which means the gate check always runs against *this*
request's cookies — no stale prerendered HTML sitting in `.next` with
gated content baked in. The subtle failure mode: if a premium post ever
gets statically cached, the lockbox state freezes at build time — you
can leak content or lock out subscribers based on whatever state the
build machine had.

Two practical consequences for anyone doing the same:

1. After changing route-generation semantics, **delete `.next` before
   rebuilding**. Stale prerenders survive incremental builds and will
   haunt you.
2. Accept that premium routes are dynamic, and design for it. Public
   posts re-render from local markdown on every request here — at this
   scale that's milliseconds, not a problem.

## What "verified" means at the end

The end-to-end flow, from a reader's perspective:

1. They sign up with email + a strong credential.
2. A verification email arrives; they click the link.
3. They log in. bcrypt verify passes, rate limit not hit, account
   verified — a session row is created, a signed cookie is set.
4. They open a premium post. The server runs `isSubscriber()`, finds
   the session, renders the full article.
5. Thirty minutes of inactivity logs them out. Thirty days without use
   expires the session. Logging out deletes it everywhere.

And from the attacker's perspective: every failure path is the same
shape — generic errors, constant-time comparisons, rate limits, a
honeypot, email proof, and a session you can kill in one SQL delete.

## The lessons worth stealing

- **Opaque tokens in a database** beat self-contained tokens when you
  need revocation. The lookup cost is one indexed query.
- **Idle timeouts are a free security win.** One column, one
  comparison.
- **Never send what you're gating.** The premium body never reaches the
  client. If your "premium" feature ships content to logged-out
  visitors in a JS bundle, you don't have a paywall, you have a
  suggestion.
- **One choke point for the business rule.** When the paid tier
  arrives, `isSubscriber()` changes and nothing else does.

Building this was two evenings of work, most of it the boring security
details nobody sees. That's the point — the lock on the post is only as
good as the dullest detail behind it.
