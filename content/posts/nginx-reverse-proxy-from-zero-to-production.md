---
title: "Nginx Reverse Proxy: From Zero to Production"
date: "2026-08-14"
excerpt: "A complete guide to setting up Nginx as a reverse proxy for your self-hosted services — routing traffic, terminating SSL, and managing multiple apps from a single public IP."
tags: ["nginx", "reverse-proxy", "linux", "ssl"]
---

One of the most powerful patterns in self-hosting is running multiple services behind a single Nginx reverse proxy. Instead of exposing each service on its own port, you route everything through port 80/443 using domain-based or path-based routing. This guide takes you from a blank Ubuntu server to a production-ready reverse proxy setup.

## Why a Reverse Proxy?

Without one, you'd need to remember different ports for each service — `app:3000`, `db:5432`, `monitoring:9090`. With Nginx, you access everything through clean URLs like `app.<YOUR_DOMAIN>`, `stats.<YOUR_DOMAIN>`, or even `/<YOUR_DOMAIN>/app`. Nginx handles SSL termination, compression, caching, and load balancing so your applications don't have to.

## Step 1: Install Nginx

On Ubuntu, this is one command:

```bash
sudo apt update
sudo apt install nginx -y
```

Verify it's running:

```bash
sudo systemctl status nginx
```

You should see "active (running)" with a green status indicator. If not, start it with `sudo systemctl start nginx`.

## Step 2: Configure DNS

Before touching Nginx, make sure your DNS is pointing at your server. You need at least an `A` record for your base domain and a wildcard (or individual) `A` record for subdomains.

For example, if your server IP is `<YOUR_SERVER>`:

```
A  @        <YOUR_SERVER>
A  *.app    <YOUR_SERVER>
A  stats    <YOUR_SERVER>
```

Adjust the subdomains to match whatever services you plan to host. A wildcard record (`*.app`) is convenient if you plan to add many subdomains under the `app` namespace.

## Step 3: Create the Nginx Configuration

Nginx configurations live in `/etc/nginx/sites-available/` and are enabled by symlinking to `/etc/nginx/sites-enabled/`.

Create a new file for your first service:

```bash
sudo nano /etc/nginx/sites-available/myapp
```

Paste this configuration, adjusting the domain and upstream to match your setup:

```nginx
server {
    listen 80;
    server_name app.<YOUR_DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Key directives explained:

- `proxy_pass` — where your application actually runs
- `proxy_set_header Host` — passes the original Host header so your app knows which domain was requested
- `proxy_set_header X-Real-IP` — passes the visitor's real IP address to your app
- `proxy_set_header X-Forwarded-Proto` — tells your app whether the original request was HTTP or HTTPS (critical for redirect logic)
- `proxy_cache_bypass` — ensures WebSocket connections and upgrades aren't cached

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
```

Test the configuration before reloading:

```bash
sudo nginx -t
```

If the test passes, reload Nginx:

```bash
sudo systemctl reload nginx
```

## Step 4: Add a Second Service

The beauty of this setup is that adding another service is nearly identical. Create another config file:

```bash
sudo nano /etc/nginx/sites-available/stats
```

```nginx
server {
    listen 80;
    server_name stats.<YOUR_DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/stats /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Each service gets its own config file, its own subdomain, and its own upstream port. They're completely isolated from each other.

## Step 5: Terminate SSL with Let's Encrypt

HTTP is fine for internal testing, but production requires HTTPS. The easiest way is Certbot with Nginx integration:

```bash
sudo apt install certbot python3-certbot-nginx -y
```

Run Certbot for each domain:

```bash
sudo certbot --nginx -d app.<YOUR_DOMAIN>
sudo certbot --nginx -d stats.<YOUR_DOMAIN>
```

Certbot will:

1. Verify you own the domain (via HTTP challenge)
2. Request and install a certificate from Let's Encrypt
3. Automatically modify your Nginx config to listen on 443 and redirect HTTP to HTTPS
4. Set up automatic renewal (via a systemd timer)

After Certbot runs, your config will look something like this:

```nginx
server {
    listen 443 ssl http2;
    server_name app.<YOUR_DOMAIN>;

    ssl_certificate /etc/letsencrypt/live/app.<YOUR_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.<YOUR_DOMAIN>/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        # ... same proxy headers as before
    }
}

server {
    listen 80;
    server_name app.<YOUR_DOMAIN>;
    return 301 https://$host$request_uri;
}
```

The HTTP block redirects everything to HTTPS. The HTTPS block handles SSL termination and proxies to your app.

## Step 6: Hardening and Best Practices

A few things every production reverse proxy should have:

**Disable unnecessary Nginx headers:**

```nginx
server_tokens off;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

Place these inside each `server { }` block or in `/etc/nginx/nginx.conf` inside the `http { }` block for site-wide application.

**Rate limiting:** Prevent abuse with simple rate limits:

```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;

location / {
    limit_req zone=general burst=20 nodelay;
    # ... rest of proxy config
}
```

**Upstream keepalive:** For high-traffic apps, keep connections alive to the backend:

```nginx
upstream myapp {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    location / {
        proxy_pass http://myapp;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        # ... other headers
    }
}
```

## Step 7: Verify Everything Works

Test each subdomain in a browser or with curl:

```bash
curl -I https://app.<YOUR_DOMAIN>
curl -I https://stats.<YOUR_DOMAIN>
```

You should see `HTTP/2 200` and your custom security headers. The HTTP versions should redirect to HTTPS with a `301` status.

Check Certbot renewal is scheduled:

```bash
sudo systemctl list-timers | grep certbot
```

You should see a renewal timer set to run twice daily. Certbot renews certificates automatically three days before expiration, so you don't need to think about it again.

## Summary

A production Nginx reverse proxy in five steps:

1. Install Nginx
2. Point your DNS at the server
3. Write per-service config files with proxy headers
4. Add more services by copying and adjusting configs
5. Install SSL with Certbot and harden with security headers

Once this foundation is in place, adding new services becomes a matter of starting the application, writing a 15-line Nginx config, and running Certbot. No complex networking, no port management, no exposed services outside the proxy. Just clean URLs and proper SSL — the way a production server should look.
