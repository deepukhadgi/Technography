---
title: "Self-Hosted Git Server with Gitea: Docker Setup Guide"
date: "2026-08-20"
excerpt: "Deploy a lightweight, full-featured Git server using Gitea and Docker Compose. Includes HTTPS, SSH access, OAuth integrations, and backup strategy."
tags: ["git", "gitea", "self-hosting", "docker"]
---

Running your own Git server gives you complete control over repositories, access policies, and data sovereignty. Gitea delivers a GitHub-like experience in a single binary that runs comfortably on modest hardware. This guide walks through a production-ready deployment using Docker Compose with PostgreSQL, HTTPS via nginx, and automated backups.

## Why Gitea?

Gitea fills the gap between bare `git init --bare` on a VPS and heavyweights like GitLab. Written in Go, it compiles to a single static binary (~80 MB), uses ~100 MB RAM at idle, and supports:

- Web UI with issue tracking, pull requests, wiki, and releases
- SSH and HTTPS git operations
- OAuth2/OpenID Connect (GitHub, GitLab, Google, custom providers)
- Webhooks and API compatibility with GitHub
- LDAP/Active Directory authentication
- Mirroring and migration from GitHub/GitLab/Bitbucket

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   nginx     │────▶│   Gitea     │
│  (git/HTTPS)│     │  (TLS/SSL)  │     │  (HTTP:3000)│
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐             │
                    │ PostgreSQL  │◀────────────┘
                    │  (port 5432)│
                    └─────────────┘
```

All components run in Docker containers managed by a single `docker-compose.yml`. The database persists to a named volume, and Gitea's data (repositories, avatars, attachments) lives in another.

## Prerequisites

- A Linux server with Docker and Docker Compose v2
- A domain name pointing to your server (e.g., `git.<YOUR_DOMAIN>`)
- Ports 80, 443, and 2222 (SSH) open on your firewall
- Basic familiarity with nginx and SSL certificates

## Step 1: Directory Structure

```bash
mkdir -p /opt/gitea/{data,postgres,nginx/conf,nginx/certs}
cd /opt/gitea
```

## Step 2: Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: gitea-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: gitea
      POSTGRES_USER: gitea
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d:ro
    secrets:
      - postgres_password
    networks:
      - gitea-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gitea -d gitea"]
      interval: 10s
      timeout: 5s
      retries: 5

  gitea:
    image: gitea/gitea:1.22-rootless
    container_name: gitea
    restart: unless-stopped
    environment:
      USER_UID: 1000
      USER_GID: 1000
      GITEA__database__DB_TYPE: postgres
      GITEA__database__HOST: postgres:5432
      GITEA__database__NAME: gitea
      GITEA__database__USER: gitea
      GITEA__database__PASSWD_FILE: /run/secrets/postgres_password
      GITEA__server__DOMAIN: git.<YOUR_DOMAIN>
      GITEA__server__SSH_DOMAIN: git.<YOUR_DOMAIN>
      GITEA__server__HTTP_PORT: 3000
      GITEA__server__ROOT_URL: https://git.<YOUR_DOMAIN>/
      GITEA__server__DISABLE_SSH: "false"
      GITEA__server__SSH_PORT: 2222
      GITEA__server__SSH_LISTEN_PORT: 22
      GITEA__service__DISABLE_REGISTRATION: "true"
      GITEA__service__REQUIRE_SIGNIN_VIEW: "true"
      GITEA__security__INSTALL_LOCK: "true"
      GITEA__security__SECRET_KEY_FILE: /run/secrets/secret_key
      GITEA__security__INTERNAL_TOKEN_FILE: /run/secrets/internal_token
      GITEA__log__MODE: console
      GITEA__log__LEVEL: info
    volumes:
      - gitea_data:/data
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "127.0.0.1:3000:3000"
      - "2222:22"
    secrets:
      - postgres_password
      - secret_key
      - internal_token
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - gitea-net

  nginx:
    image: nginx:alpine
    container_name: gitea-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf:/etc/nginx/conf.d:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - gitea
    networks:
      - gitea-net

volumes:
  postgres_data:
  gitea_data:

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  secret_key:
    file: ./secrets/secret_key.txt
  internal_token:
    file: ./secrets/internal_token.txt

networks:
  gitea-net:
    driver: bridge
```

**Key configuration notes:**

- `GITEA__server__ROOT_URL` must match your public HTTPS URL exactly (trailing slash required)
- SSH runs on port 2222 externally, mapped to port 22 inside the container
- `GITEA__service__DISABLE_REGISTRATION: "true"` prevents public signups — create users via admin panel or CLI
- Secrets are stored in files under `./secrets/` (never in the compose file)

## Step 3: Generate Secrets

```bash
mkdir -p /opt/gitea/secrets

# Database password (32+ chars)
openssl rand -base64 32 > /opt/gitea/secrets/postgres_password.txt

# Gitea secret key (64 chars, used for JWT signing, CSRF, etc.)
openssl rand -base64 48 > /opt/gitea/secrets/secret_key.txt

# Internal token for inter-service communication
openssl rand -base64 32 > /opt/gitea/secrets/internal_token.txt

chmod 600 /opt/gitea/secrets/*.txt
```

## Step 4: nginx Configuration

Create `/opt/gitea/nginx/conf/gitea.conf`:

```nginx
server {
    listen 80;
    server_name git.<YOUR_DOMAIN>;
    
    # ACME challenge for Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name git.<YOUR_DOMAIN>;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    
    # Modern SSL config
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Git operations over HTTPS need larger body limits
    client_max_body_size 100M;

    location / {
        proxy_pass http://gitea:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support for real-time features
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts for large pushes
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

## Step 5: Obtain TLS Certificates

Using Let's Encrypt with certbot (run on host, not in container):

```bash
# Install certbot
apt update && apt install -y certbot

# Obtain certificate (standalone mode, ports 80/443 must be free temporarily)
docker compose down nginx
certbot certonly --standalone -d git.<YOUR_DOMAIN> --email admin@<YOUR_DOMAIN> --agree-tos --no-eff-email

# Copy certs to nginx directory
cp /etc/letsencrypt/live/git.<YOUR_DOMAIN>/fullchain.pem /opt/gitea/nginx/certs/
cp /etc/letsencrypt/live/git.<YOUR_DOMAIN>/privkey.pem /opt/gitea/nginx/certs/
chmod 644 /opt/gitea/nginx/certs/*

# Restart nginx
docker compose up -d nginx
```

Set up auto-renewal with a cron job:

```bash
# /etc/cron.d/certbot-gitea
0 3 * * * root certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/git.<YOUR_DOMAIN>/fullchain.pem /opt/gitea/nginx/certs/ && cp /etc/letsencrypt/live/git.<YOUR_DOMAIN>/privkey.pem /opt/gitea/nginx/certs/ && docker compose -f /opt/gitea/docker-compose.yml restart nginx"
```

## Step 6: Launch the Stack

```bash
cd /opt/gitea
docker compose up -d
```

Verify all containers are healthy:

```bash
docker compose ps
# All services should show "healthy" or "running"
```

## Step 7: Initial Configuration

Visit `https://git.<YOUR_DOMAIN>` in your browser. You'll see the Gitea installation page. Since we pre-configured database and security settings via environment variables, most fields are pre-filled. Complete these:

1. **Site Title**: Your organization or personal name
2. **Repository Root Path**: Keep default `/data/git/repositories`
3. **Git LFS Root Path**: Keep default `/data/git/lfs`
4. **Administrator Account**: Create your admin user (username, email, password)
5. Click **Install Gitea**

After installation, you're redirected to the dashboard as the admin user.

## Step 8: SSH Access Configuration

Gitea serves SSH on port 2222. Add your SSH public key in **Settings → SSH / GPG Keys → Add Key**. Test:

```bash
ssh -p 2222 git@git.<YOUR_DOMAIN>
# Should show: "Hi there, <username>! You've successfully authenticated..."
```

For `git clone` over SSH:

```bash
git clone ssh://git@git.<YOUR_DOMAIN>:2222/username/repo.git
```

## Step 9: OAuth Integration (Optional)

Enable GitHub/GitLab login for team members:

1. Go to **Site Administration → Authentication → OAuth2**
2. Click **Add OAuth2 Provider**
3. For GitHub:
   - Provider: GitHub
   - Client ID/Secret: Create at GitHub Settings → Developer settings → OAuth Apps
   - Callback URL: `https://git.<YOUR_DOMAIN>/user/oauth2/github/callback`
4. Repeat for GitLab, Google, or custom OIDC providers

## Step 10: Automated Backups

Gitea includes a built-in dump command. Create a backup script at `/opt/gitea/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/gitea/backups"
RETENTION_DAYS=30
DATE=$(date +%F-%H%M)

mkdir -p "$BACKUP_DIR"

# Gitea dump (includes DB, repos, config, attachments)
docker compose -f /opt/gitea/docker-compose.yml exec -T gitea \
  gitea dump -c /data/gitea/conf/app.ini --temp-dir /tmp/gitea-dump \
  --skip-repository --skip-custom-dir --skip-log

# The dump creates a zip in /data/gitea/ inside container
# Copy it out
docker cp gitea:/data/gitea/gitea-dump-${DATE}.zip "$BACKUP_DIR/"

# Also dump PostgreSQL separately for point-in-time recovery
docker compose -f /opt/gitea/docker-compose.yml exec -T postgres \
  pg_dump -U gitea -d gitea | gzip > "$BACKUP_DIR/postgres-${DATE}.sql.gz"

# Cleanup old backups
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR/gitea-dump-${DATE}.zip"
```

Make it executable and schedule via cron:

```bash
chmod +x /opt/gitea/backup.sh

# Daily at 2 AM
echo "0 2 * * * root /opt/gitea/backup.sh >> /var/log/gitea-backup.log 2>&1" > /etc/cron.d/gitea-backup
```

Test the backup:

```bash
/opt/gitea/backup.sh
ls -lh /opt/gitea/backups/
```

## Step 11: Monitoring and Maintenance

### Health Checks

```bash
# Container health
docker compose ps

# Gitea application health
curl -sf https://git.<YOUR_DOMAIN>/api/healthz

# Database connectivity
docker compose exec postgres pg_isready -U gitea -d gitea
```

### Log Access

```bash
# Gitea logs
docker compose logs -f gitea

# nginx logs
docker compose logs -f nginx

# PostgreSQL logs
docker compose logs -f postgres
```

### Updates

```bash
cd /opt/gitea
docker compose pull
docker compose up -d
# Run migrations if prompted in logs
```

Gitea handles database migrations automatically on startup. Check logs for `Running migration` messages.

## Disaster Recovery

To restore from backup on a fresh server:

```bash
# 1. Deploy fresh stack (steps 1-6)
# 2. Stop Gitea
docker compose stop gitea

# 3. Restore database
gunzip -c /opt/gitea/backups/postgres-2026-08-20-0200.sql.gz | \
  docker compose exec -T postgres psql -U gitea -d gitea

# 4. Restore repositories and data
docker cp /opt/gitea/backups/gitea-dump-2026-08-20-0200.zip gitea:/data/gitea/
docker compose exec gitea gitea restore --from /data/gitea/gitea-dump-2026-08-20-0200.zip

# 5. Restart
docker compose start gitea
```

## Security Hardening Checklist

- [ ] SSH key-only authentication (disable password auth in container's `/etc/ssh/sshd_config`)
- [ ] Fail2ban on host for nginx and SSH ports
- [ ] Regular security updates: `apt update && apt upgrade -y` monthly
- [ ] Monitor Gitea security advisories at <https://github.com/go-gitea/gitea/security/advisories>
- [ ] Restrict admin panel access to known IPs via nginx `allow/deny`
- [ ] Enable 2FA for all users (Settings → Account → Two-Factor Authentication)

## Resource Requirements

| Component | CPU | RAM | Disk |
|-----------|-----|-----|------|
| Gitea | 0.5-1 core | 100-300 MB | Repos + 500 MB |
| PostgreSQL | 0.5 core | 200-500 MB | DB + WAL |
| nginx | 0.1 core | 20-50 MB | Logs + certs |

A 2 vCPU / 2 GB RAM VPS handles ~50 active users comfortably. Scale PostgreSQL and add Redis for session caching beyond that.

## Conclusion

You now have a production-grade Git server with HTTPS, SSH, OAuth, and automated backups — all in ~200 MB RAM. Gitea's single-binary architecture makes updates trivial, and Docker Compose keeps the stack portable across hosts. For teams outgrowing a single instance, Gitea supports clustering with a shared database and object storage, but that's a topic for another post.

---

**Next steps to explore:**
- Configure Gitea Actions for CI/CD (built-in, uses Docker)
- Set up repository mirroring from GitHub/GitLab
- Integrate with Drone or Woodpecker for external CI
- Add Prometheus metrics (`GITEA__metrics__ENABLED: true`) and Grafana dashboards