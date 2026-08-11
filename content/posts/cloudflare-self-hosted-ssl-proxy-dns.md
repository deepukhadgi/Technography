---
title: "Cloudflare + Self-Hosted: SSL, Proxy, and DNS for Homelabbers"
date: "2026-08-11"
excerpt: "How to connect a self-hosted homelab to the internet using Cloudflare's free tier — SSL termination, DNS, and reverse proxy without exposing your home IP."
tags: ["cloudflare", "networking", "ssl", "security", "homelab"]
---

# Cloudflare + Self-Hosted: SSL, Proxy, and DNS for Homelabbers

One of the first hurdles every homelabber faces is figuring out how to expose services safely to the internet. You don't want to forward ports on your home router, and you certainly don't want to run without HTTPS. Cloudflare sits in the middle and solves all of this — for free.

In this guide, I'll walk through the exact setup I use for my homelab: DNS via Cloudflare, an Origin CA certificate for encryption between Cloudflare and my server, and nginx as a reverse proxy with proper security headers.

## Why Cloudflare?

Cloudflare's free tier gives you:

- **DNS hosting** with a global Anycast network (faster lookups, DDoS protection)
- **Automatic HTTPS** — Cloudflare terminates TLS at their edge
- **Reverse proxy** — your home IP never appears in public DNS
- **DDoS protection** and basic WAF rules out of the box
- **Page Rules** for redirects, caching overrides, and more

The key concept: Cloudflare sits between the internet and your server. Visitors talk to Cloudflare over HTTPS; Cloudflare talks to your server over HTTPS (using a self-signed Origin CA cert) or HTTP. Your home IP stays hidden.

## Step 1: Point Your Domain to Cloudflare

Log into your domain registrar and update the nameservers to Cloudflare's. For example, if you're using Cloudflare's nameservers:

```
ns1.cloudflare.com
ns2.cloudflare.com
```

After the change propagates (usually minutes, sometimes hours), add your domain in the Cloudflare dashboard. Cloudflare will scan for existing records — accept the defaults and continue.

## Step 1.5: Create Your DNS Record

In the Cloudflare dashboard, go to **DNS > Records** and add an **A record**:

| Type | Name | Content | Proxy status | TTL |
|------|------|---------|-------------|-----|
| A    | @    | <YOUR_SERVER_IP> | Proxied (orange cloud) | Auto |

The **proxied** status is critical — it routes traffic through Cloudflare's network. A DNS-only (gray cloud) record would expose your home IP.

For subdomains like `blog.<YOUR_DOMAIN>` or `vpn.<YOUR_DOMAIN>`, add additional A records pointing to the same IP.

## Step 2: Generate an Origin CA Certificate

Cloudflare offers a free **Origin Certificate** — a self-signed certificate that encrypts traffic between Cloudflare and your server. This is different from a public CA cert; your browser won't trust it directly, but Cloudflare does.

In the Cloudflare dashboard: **SSL/TLS > Origin Server > Create Certificate**.

Choose:
- **Certificate type**: Origin Certificate
- **Key type**: RSA (2048-bit)
- **Hostnames**: `*.<YOUR_DOMAIN>` and `<YOUR_DOMAIN>` (wildcard + apex)

Cloudflare will give you a certificate and a private key. Save both — you'll need them on your server.

## Step 3: Configure nginx as a Reverse Proxy

On your server, install nginx:

```bash
sudo apt update && sudo apt install nginx -y
```

Create an origin certificate directory:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp origin.crt /etc/nginx/ssl/
sudo cp origin.key /etc/nginx/ssl/
sudo chown root:root /etc/nginx/ssl/*
sudo chmod 600 /etc/nginx/ssl/*
```

Now create a server block for your service. Here's a template for a blog running on port 3000:

```nginx
server {
    listen 80;
    server_name blog.<YOUR_DOMAIN>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name blog.<YOUR_DOMAIN>;

    ssl_certificate     /etc/nginx/ssl/origin.crt;
    ssl_certificate_key /etc/nginx/ssl/origin.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and test:

```bash
sudo ln -s /etc/nginx/sites-available/blog.<YOUR_DOMAIN> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

## Step 4: Configure Cloudflare SSL/TLS

Go to **SSL/TLS > Overview** in the Cloudflare dashboard and set the encryption mode to **Full (Strict)**. This tells Cloudflare to always use HTTPS to your origin, and to verify the Origin CA certificate.

| Setting | Value |
|---------|-------|
| Encryption mode | Full (Strict) |
| Always Use HTTPS | On |
| HSTS | On |
| Minimum TLS Version | TLS 1.2 |

## Step 5: Harden with Additional Cloudflare Settings

A few more settings that matter:

- **SSL/TLS > Edge Certificates > Automatic HTTPS Revisions**: On (auto-redirects HTTP to HTTPS)
- **Security > WAF**: Set to Under Attack or High if you're seeing scans
- **Speed > Optimization**: Compress text, browse caching, and minify if needed
- **Security > Bot Fight Mode**: On (catches non-browser traffic)

For extra protection, you can restrict access by IP. If your home IP changes, consider a VPN or a static IP from your ISP.

## Step 6: Set Up Fail2ban on Your Server

Even behind Cloudflare, your server should still be hardened. Install fail2ban to block repeated failed SSH/logins:

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

Create `/etc/fail2ban/jail.local`:

```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5
```

Restart: `sudo systemctl restart fail2ban`

## What You've Achieved

- Your homelab services are reachable at `https://<YOUR_DOMAIN>` without port forwarding
- All traffic is encrypted (Cloudflare ↔ visitor, Cloudflare ↔ your server)
- Your home IP is hidden behind Cloudflare's proxy
- Basic DDoS protection and bot mitigation are active
- Your server has fail2ban as a second layer of defense

This setup works for any service — a blog, a VPN gateway, a media server, or an AI agent frontend. The pattern is the same: DNS → Cloudflare proxy → nginx → your app.

The only thing left is to make sure your upstream services are listening on `127.0.0.1` (not `0.0.0.0`) so they're not directly reachable from the internet — nginx is your only public entry point.
