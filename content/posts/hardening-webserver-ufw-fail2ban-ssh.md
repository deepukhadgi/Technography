---
title: "How I Hardened My Webserver in 10 Minutes — UFW + fail2ban + SSH"
date: "2026-08-14"
excerpt: "A practical, no-fluff guide to hardening a fresh Ubuntu webserver with UFW, fail2ban, and SSH lock-down — the kind of post I wish I had when I first stood up my homelab."
tags: ["security", "linux", "ubuntu", "homelab"]
---

When I first stood up a VPS for my blog, I treated it like a toy. SSH open to the world, root login enabled, firewall wide open. Then I ran a simple scan of the public internet and watched the login attempts pile up in real time — hundreds per hour from a dozen countries. That was the day I decided to harden my server, and the whole process took me about ten minutes.

Here's exactly what I did, step by step, so you can do the same without overthinking it.

## Step 1: Lock Down SSH

The biggest attack surface on any fresh Linux server is SSH. Most brute-force tools target port 22 with dictionary attacks 24/7. The fixes are straightforward:

**Disable root login.** Edit `/etc/ssh/sshd_config` and set:

```
PermitRootLogin no
```

This prevents anyone from logging in as root directly. You'll need a regular user with sudo privileges first. If you don't have one, create it:

```bash
sudo adduser <YOUR_USERNAME>
sudo usermod -aG sudo <YOUR_USERNAME>
```

**Limit authentication attempts.** Add this to the same config file:

```
MaxAuthTries 3
```

This tells SSH to drop the connection after three failed attempts, which slows down automated attackers significantly.

**Disable password auth entirely.** If you're using SSH keys (and you should be), this is the single most effective hardening step:

```
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM no
```

Restart the SSH daemon to apply:

```bash
sudo systemctl restart sshd
```

Before you log out, test the new connection from a separate terminal to make sure you haven't locked yourself out.

## Step 2: Set Up UFW

Uncomplicated Firewall (UFW) is Ubuntu's frontend for iptables. It's simple, it works, and it ships pre-installed.

**Enable UFW and set defaults:**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

This blocks all inbound traffic by default and allows everything outbound. It's the safest baseline.

**Open only what you need:**

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
```

If you're running additional services (a database on a non-standard port, a custom app, etc.), add those rules too — but keep the list short. Every open port is a potential attack vector.

**Enable the firewall:**

```bash
sudo ufw enable
```

You'll see a warning about disrupting existing SSH connections. If you're connected via SSH, this is fine as long as rule 22 is already in place — which it is.

**Verify the rules:**

```bash
sudo ufw status numbered
```

You should see exactly three allow rules and two default deny rules. Anything else means you opened more than necessary.

## Step 3: Install and Configure fail2ban

fail2ban monitors log files for suspicious patterns and temporarily bans offending IP addresses. It's a force multiplier for your firewall — UFW blocks known-bad traffic, fail2ban creates the blocklists.

**Install it:**

```bash
sudo apt install fail2ban -y
```

**Copy the default config** so you can customize it without losing upstream updates:

```bash
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

**Edit `/etc/fail2ban/jail.local`:**

```ini
[DEFAULT]
ban时间 = 3600
bantime = 3600
findtime = 600
maxretry = 3
backend = auto

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

This bans any IP that fails SSH login three times within a ten-minute window, for one hour. Adjust the times to your preference — longer bans are better for high-traffic servers.

**Enable and start the service:**

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**Check the status:**

```bash
sudo fail2ban-client status sshd
```

You should see the number of currently banned IPs. On a fresh server, this is usually zero on day one. After a few days of real traffic, you'll start seeing numbers climb — and that's the point.

## Step 4: Enable Automatic Security Updates

Ubuntu can install security patches automatically, which closes the most common vulnerability window.

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure -plow unattended-upgrades
```

Confirm "Yes" when asked whether to enable automatic updates. This ensures your server stays patched without manual intervention.

## Step 5: Final Verification

Run these checks to confirm everything is in place:

```bash
# Firewall rules
sudo ufw status numbered

# fail2ban status
sudo fail2ban-client status

# SSH config (关键行)
grep -E "PermitRootLogin|PasswordAuthentication|MaxAuthTries" /etc/ssh/sshd_config

# Security updates enabled
dpkg -l unattended-upgrades
```

That's it. Ten minutes, five steps, and your server goes from "open invitation" to "hardened target." The scan results I saw earlier dropped from hundreds of successful login attempts per day to essentially zero within hours of applying these changes.

Hardening isn't about perfection — it's about raising the cost for attackers until they move on to easier targets. These five steps do exactly that.
