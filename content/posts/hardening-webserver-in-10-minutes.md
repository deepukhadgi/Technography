---
title: "How I Hardened My Webserver in 10 Minutes"
date: "2026-08-05"
excerpt: "Firewall, fail2ban, automatic security updates, and a locked-down SSH — the exact commands I ran to harden a fresh Ubuntu webserver in ten minutes."
tags: ["security", "self-hosting", "ssh", "ufw", "fail2ban"]
---

A fresh Ubuntu server, root login over password, every port open. That
was my webserver for about an hour — long enough to make me uneasy,
short enough that nothing bad happened. Then I spent ten minutes
hardening it, and it's been quiet ever since.

This is the tutorial I wish I'd had: four layers, exact commands, and
the reasoning behind each one. If you're about to point a domain at any
VPS or home server, do this first. It takes less time than watching a
YouTube video about it.

## Layer 1 — the firewall: UFW

Ubuntu ships with UFW (Uncomplicated Firewall). Deny everything
incoming, then allow exactly the three ports the internet is allowed to
touch:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status verbose
```

That's the whole firewall. No 3000, no 8080, no database ports — my
Node.js app listens on 127.0.0.1 with nginx in front, so the outside
world never sees the app port at all. Deny-by-default means anything I
open later is a conscious decision, not an accident.

## Layer 2 — brute-force protection: fail2ban

A firewall stops connections; it doesn't stop someone hammering SSH
with guessed passwords a thousand times a night. That's fail2ban's job —
it watches the auth logs and bans an IP after a few failures.

```bash
sudo apt install fail2ban
```

Then create `/etc/fail2ban/jail.local`:

```ini
[sshd]
enabled = true
port = ssh
maxretry = 5
bantime = 1h
```

```bash
sudo systemctl enable --now fail2ban
```

Five failed attempts, one hour ban. Check it's working:

```bash
sudo fail2ban-client status sshd
```

You'll see banned IPs listed there — usually within the first week,
which is how you know it's earning its keep. Tune the numbers to taste;
I keep them low because I use key-based auth anyway (more below).

## Layer 3 — automatic security patches: unattended-upgrades

The most exploited vulnerabilities are the ones with public patches
nobody applied. `unattended-upgrades` installs security updates
automatically, so the window between "CVE published" and "you got
around to it" disappears.

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Answer "Yes" to the prompt, or check the config in
`/etc/apt/apt.conf.d/50unattended-upgrades` and confirm the
`origin=.../stable,label=...-security` lines are uncommented. By
default it only touches security updates — no surprise distro upgrades
at 3am.

## Layer 4 — SSH hardening

Password auth for root is the classic entry point. My SSH config lives
in `/etc/ssh/sshd_config.d/hardening.conf`:

```ini
PermitRootLogin no
AllowUsers deploy
X11Forwarding no
MaxAuthTries 3
```

- `PermitRootLogin no` — no root over SSH, ever. Log in as a normal
  user and `sudo`.
- `AllowUsers deploy` — a whitelist. Anyone not on the list doesn't
  even get to try a password.
- `X11Forwarding no` — I don't forward X; it's a server.
- `MaxAuthTries 3` — three password attempts max per connection.

Reload with `sudo systemctl reload sshd` — and do this from a session
you keep open, with a second terminal ready to test. Locking yourself
out of your own server is a rite of passage, but it's better skipped.

If you haven't switched to SSH keys yet, do that before disabling
password auth entirely — `ssh-copy-id` makes it painless, and then
`PasswordAuthentication no` closes the brute-force hole completely.

## The Cloudflare caveat

My site sits behind Cloudflare, which hides the origin IP — but that's
a speed bump, not a wall. The origin is discoverable: email headers
carry the mail server's address, historical DNS records are public, and
certificate transparency logs list every certificate ever issued for
your domain. Assume the origin will be found and harden accordingly.
The proxy makes attacks harder; the firewall and fail2ban make them
pointless.

## Ten minutes later

Four layers, ten minutes: a deny-by-default firewall, an SSH jail that
bans repeat offenders, automatic security patches, and a rootless,
whitelisted SSH. This stops the endless background noise — script
kiddies, credential stuffing, the daily port scan — so the things that
actually need my attention stand out.

It won't stop a determined attacker, and nothing on this list pretends
to. But it raises the cost of getting in far above the value of a small
blog server, and that's the whole game. Keep updates on, keep an eye on
fail2ban's ban list, and sleep fine.

*The full behind-the-scenes of how this blog is built and operated —
including the AI agent that deploys it — lives in the subscriber post:
[Building a Self-Hosted Blog with AI-Powered Automation](/blog/building-self-hosted-blog-ai-automation).*
