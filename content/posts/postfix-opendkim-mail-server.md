---
title: "Postfix + OpenDKIM: Self-Hosted Mail Server That Actually Works"
date: "2026-08-10"
excerpt: "A sending-only Postfix setup that signs every message with DKIM, passes SPF and DMARC, and lands in the inbox — with a relay handling IP reputation so your server IP never matters."
tags: ["mail", "postfix", "dkim", "smtp", "linux"]
---

"Self-hosted mail" is a punchline in homelab circles, and the jokes are deserved. Most tutorials stop at "your mail sends" — then the first real message lands in spam and you spend a weekend Googling why. The missing 80% is authentication: SPF, DKIM, DMARC, plus reverse DNS and IP reputation. This guide builds a mail server that actually reaches inboxes.

## What we are building

A **sending-only Postfix** (the "null client" pattern) that accepts mail from local services — cron jobs, the blog, monitoring alerts — signs every message with DKIM through the OpenDKIM milter, and hands it to a transactional relay over authenticated SMTP.

```
local app → Postfix → OpenDKIM (signs) → relay → recipient inbox
```

The relay is the critical ingredient. Providers like SMTP2GO, Amazon SES, or Mailgun own a fleet of IP addresses with decades of accumulated reputation. Your fresh VPS IP has exactly none, and many consumer ISPs block outbound port 25 entirely. Delegating delivery to a relay means your inbox placement no longer depends on your IP's history — only on your DNS authentication, which you control.

<figure>
  <img src="/images/postfix-opendkim-mail-server-diagram.png" alt="Self-hosted mail architecture: Local App → Postfix (null client) → OpenDKIM (DKIM signing) → SMTP Relay (TLS, port 587) → Recipient Inbox, with DNS records SPF, DKIM, DMARC, and PTR verified by the recipient server" width="1200" height="600" loading="lazy" style="width:100%;height:auto;border-radius:0.5rem;border:1px solid var(--color-line)" />
  <figcaption class="font-mono text-xs text-dim mt-2 text-center">The full mail path: your local app hands off to Postfix, OpenDKIM stamps the DKIM signature, and a reputable relay delivers to the recipient — with DNS records proving authenticity at every hop.</figcaption>
</figure>

## Step 0 — Prerequisites

- An Ubuntu server (22.04 or newer works fine).
- A domain whose DNS you control.
- A hostname for the box: `mail.<YOUR_DOMAIN>`.
- A relay account with SMTP credentials (any of the providers above; most have a free tier).

One thing to ask your hosting provider for: a **PTR (reverse DNS) record** mapping your server's IP to `mail.<YOUR_DOMAIN>`. You cannot set this yourself — it lives with whoever owns the IP. Mail testers check that the reverse hostname matches what your server says it is, so get this right first.

## Step 1 — Install the packages

```bash
sudo apt update
sudo apt install -y postfix opendkim opendkim-tools mailutils
```

During install, Postfix asks for the mail configuration type — pick **Internet Site**, then set the mail name to `<YOUR_DOMAIN>`. Confirm the version afterwards:

```bash
postconf mail_version
# mail_version = 3.8.x
```

## Step 2 — Configure Postfix as a null client

Edit `/etc/postfix/main.cf` and replace the interesting parts:

```
myhostname = mail.<YOUR_DOMAIN>
mydomain = <YOUR_DOMAIN>
mydestination = $myhostname, localhost.localdomain, localhost
inet_interfaces = loopback-only
relayhost = [<YOUR_SMTP_RELAY>]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
```

Two lines deserve attention. `inet_interfaces = loopback-only` means this server will never accept a connection from the outside world — it is a client, not a server, so there is no open-relay risk to worry about. `smtp_tls_security_level = encrypt` forces TLS to the relay; anything less would send your credentials in the clear.

Now create the credential file with the relay's SMTP login:

```
[<YOUR_SMTP_RELAY>]:587 <YOUR_USERNAME>:<YOUR_CREDENTIAL>
```

Then:

```bash
sudo chmod 600 /etc/postfix/sasl_passwd   # refuse to share this file
sudo postmap /etc/postfix/sasl_passwd     # build the hashed lookup table
sudo postfix check
sudo systemctl reload postfix
```

`postfix check` should print nothing and exit cleanly — that is what success looks like.

## Step 3 — Generate DKIM keys

DKIM proves a message was signed by the domain it claims to come from. The recipient's server looks up your public key in DNS and verifies the signature in the message headers.

```bash
sudo mkdir -p /etc/opendkim/keys/<YOUR_DOMAIN>
cd /etc/opendkim/keys/<YOUR_DOMAIN>
sudo opendkim-genkey -b 2048 -s mail -d <YOUR_DOMAIN> --directory=/etc/opendkim/keys/<YOUR_DOMAIN>
sudo chown -R opendkim:opendkim /etc/opendkim/keys
```

This creates two files: `mail.private` (the signing key — it stays on the server, never leaves) and `mail.txt` (the public key that goes into DNS). 2048-bit RSA is the current sweet spot: universally supported, and DNS-friendly.

## Step 4 — Wire up OpenDKIM

Configure `/etc/opendkim.conf`:

```
Mode                sv
Socket              inet:8891@localhost
Canonicalization    relaxed/relaxed
SigningAlgorithm    rsa-sha256
KeyTable            /etc/opendkim/key.table
SigningTable        /etc/opendkim/signing.table
InternalHosts       /etc/opendkim/trusted.hosts
```

Then the two lookup tables. `/etc/opendkim/key.table`:

```
mail._domainkey.<YOUR_DOMAIN> <YOUR_DOMAIN>:mail:/etc/opendkim/keys/<YOUR_DOMAIN>/mail.private
```

`/etc/opendkim/signing.table`:

```
*@<YOUR_DOMAIN> mail._domainkey.<YOUR_DOMAIN>
```

And `/etc/opendkim/trusted.hosts`:

```
localhost
127.0.0.1
::1
```

Back in Postfix's `main.cf`, tell it to use the milter:

```
smtpd_milters     = inet:localhost:8891
non_smtpd_milters = inet:localhost:8891
milter_default_action = accept
```

Restart both services and confirm the milter is alive:

```bash
sudo systemctl restart opendkim postfix
sudo journalctl -u opendkim --no-pager | tail -5
```

You should see the milter announce it is ready to receive connections on port 8891.

## Step 5 — DNS records (the part everyone skips)

Three TXT records decide your fate. Note that a single DNS TXT record is capped at 255 characters; `opendkim-genkey` already splits `mail.txt` into properly quoted segments, so paste them exactly as printed.

**SPF** — at the zone root (`@`):

```
v=spf1 include:<YOUR_RELAY_SPF_INCLUDE> ~all
```

`<YOUR_RELAY_SPF_INCLUDE>` is the include your relay publishes (every major relay documents one). The `~all` soft-fail is the safe default; tighten to `-all` once you are confident nothing else sends as your domain.

**DKIM** — at `mail._domainkey`:

```
v=DKIM1; k=rsa; p=<PUBLIC_KEY_FROM_MAIL.TXT>
```

**DMARC** — at `_dmarc`:

```
v=DMARC1; p=quarantine; rua=mailto:postmaster@<YOUR_DOMAIN>
```

Verify each record resolves:

```bash
dig +short TXT mail._domainkey.<YOUR_DOMAIN>
dig +short TXT <YOUR_DOMAIN> | grep spf
dig +short TXT _dmarc.<YOUR_DOMAIN>
```

Propagation is usually minutes on modern DNS providers, occasionally up to a day on slower registrars. Wait for the DKIM record to resolve before testing.

## Step 6 — Verify everything

First, confirm OpenDKIM can find and validate the key locally:

```bash
sudo opendkim-testkey -d <YOUR_DOMAIN> -s mail -vvv
# key OK
```

The `key OK` output is the moment of truth. Then send a real test:

```bash
mail -s "Deliverability test" test@mail-tester.com
```

Open the address mail-tester.com shows you, paste the score page URL it emails back, and look at the breakdown. Target **10/10**. The three checks that matter most:

1. **PTR and hostname match** — your reverse DNS must line up with `mail.<YOUR_DOMAIN>`.
2. **DKIM signature valid** — confirm the signature was added with `grep "DKIM-Signature" /var/log/mail.log`.
3. **SPF pass** — the relay's outbound IPs must appear in your SPF include.

Every failed check on mail-tester links straight to the exact DNS record or config line to fix — it is the fastest mail debugging tool that exists.

## Step 7 — Keep it out of spam

- **Warm up**: start at 50–100 messages a day for the first two weeks. A sudden burst of thousands of messages from a brand-new domain is a spam signal.
- **Never mail bought lists**: one spam complaint rate above ~0.1% gets you quarantined by every major provider.
- **Watch bounces**: every hard bounce damages reputation. Remove invalid addresses immediately.
- **Read your DMARC reports**: the `rua` mailbox collects XML reports from recipients — spot spoofing attempts early and confirm legitimate mail is authenticating.

## Pitfalls I hit so you do not

- **Missing `chmod 600`** on `sasl_passwd` — Postfix warns and the relay rejects your auth. The permissions are not a suggestion.
- **OpenDKIM not running** — Postfix silently queues everything. Check `journalctl -u opendkim` *before* tearing your hair out over DNS.
- **Wrong KeyTable path** — mail log shows `key not found` for every message. The path in `key.table` must be absolute.
- **No DMARC** — some providers silently downgrade mail from domains without a policy.
- **Deleting `relayhost`** "to test" — Postfix then tries direct delivery from your IP, and you are back to square one with a worse reputation.

## The takeaway

Self-hosted mail is 20% mail transfer agent and 80% authentication. With DKIM signing in front of a reputable relay — and SPF and DMARC behind it — a tiny VM sends like a grown-up mail platform. Score 10/10 on mail-tester, watch your bounces drop to zero, and enjoy a mail server that *actually works*.
