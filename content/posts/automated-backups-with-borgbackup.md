---
title: "Automated Backups with BorgBackup to Remote Storage"
date: "2026-08-19"
excerpt: "A complete guide to setting up automated, encrypted, deduplicated backups with BorgBackup — from local repositories to remote storage with retention policies and monitoring."
tags: ["backup", "borg", "automation", "linux"]
---

Backups are the insurance policy you hope to never need — but when you do, they better work. After losing a homelab database to a failed migration (yes, really), I built a backup system that runs nightly, encrypts everything client-side, deduplicates across servers, and reports status to my monitoring stack. This post walks through the complete setup.

## Why BorgBackup?

BorgBackup (borg) solves the hard problems other tools gloss over:

- **Deduplication**: Only changed chunks are stored. My 50 GB of Nextcloud data takes ~2 GB after the first backup.
- **Encryption**: AES-256 + HMAC-SHA256 client-side. The remote storage never sees plaintext.
- **Compression**: LZ4 by default, zstd if you prefer speed/size tradeoffs.
- **Mountable**: `borg mount` lets you browse any snapshot as a regular filesystem.
- **Remote support**: SSH, S3-compatible, or custom remotes via rclone.

Compare this to rsync (no dedup), restic (slower, no mount on all platforms), or Duplicati (heavy, GUI-focused). Borg hits the sweet spot for CLI-driven homelabs.

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Server A   │────▶│  Borg Repo  │◀───▶│  Remote Storage  │
│  (data)     │ SSH │  (local)    │     │  (S3/Backblaze)  │
└─────────────┘     └─────────────┘     └──────────────────┘
       ▲                                      │
       │           ┌─────────────┐            │
       └──────────▶│  Server B   │────────────┘
                   │  (borg serve)│
                   └─────────────┘
```

**Key components:**
1. **Local repository** on <YOUR_SERVER> — fast restores, short-term retention
2. **Remote repository** on Backblaze B2 / S3 — disaster recovery, long-term retention
3. **borgmatic** — declarative YAML config, hooks, retention, health checks
4. **Prometheus exporter** — `borg_exporter` scrapes last backup time, size, errors

## Step 1: Install Borg and Borgmatic

On Debian/Ubuntu:

```bash
apt update && apt install -y borgbackup python3-pip
pip3 install --break-system-packages borgmatic
```

On Arch: `pacman -S borg borgmatic`

Verify: `borg --version` and `borgmatic --version`

## Step 2: Initialize Repositories

**Local repo** (on your backup server):
```bash
export BORG_PASSPHRASE="$(cat /etc/borg/local-passphrase)"
borg init --encryption=repokey-blake2 /mnt/backup/borg-local
```

**Remote repo** (Backblaze B2 example):
```bash
export BORG_PASSPHRASE="$(cat /etc/borg/remote-passphrase)"
borg init --encryption=repokey-blake2 b2://bucket-name:path/to/repo
```

> **Security note**: Use `repokey` (not `keyfile`) so the key lives *inside* the repo. Store passphrases in `/etc/borg/*.passphrase` (mode 600, root-only). Never hardcode them.

## Step 3: Configure Borgmatic

Create `/etc/borgmatic/config.yaml`:

```yaml
location:
  source_directories:
    - /etc
    - /home
    - /var/lib/docker/volumes
    - /opt/appdata
  repositories:
    - path: /mnt/backup/borg-local
      label: local
    - path: b2://bucket-name:path/to/repo
      label: remote

retention:
  keep_daily: 7
  keep_weekly: 4
  keep_monthly: 6
  keep_yearly: 2
  prefix: "{hostname}-"

consistency:
  checks:
    - name: repository
      frequency: 2 weeks
    - name: archives
      frequency: 1 month
    - name: extract
      frequency: 3 months

hooks:
  before_backup:
    - systemctl stop docker  # optional: quiesce databases
    - pg_dumpall > /tmp/pg_dump.sql
  after_backup:
    - systemctl start docker
    - curl -fsS -m 10 --retry 3 -o /dev/null "https://hc-ping.com/<YOUR_UUID>"

storage:
  compression: lz4
  lock_wait: 60

output:
  json: true
```

**Important settings explained:**
- `retention.prefix`: Includes hostname so multi-server repos don't collide
- `consistency.checks`: Automated integrity verification — repository (fast), archives (thorough), extract (full test restore)
- `hooks`: Pre/post commands for app quiescing and health-check pings (Healthchecks.io, Uptime Kuma, etc.)

## Step 4: SSH Key for Remote Access

Generate a dedicated key:
```bash
ssh-keygen -t ed25519 -f /root/.ssh/borg-backup -N ""
```

Add the public key to your remote's `authorized_keys` with a forced command:
```
command="borg serve --restrict-to-path /path/to/repo",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA...
```

This limits the key to *only* running `borg serve` on that specific path.

## Step 5: Systemd Timer (Better Than Cron)

`/etc/systemd/system/borgmatic-backup.service`:
```ini
[Unit]
Description=Borgmatic Backup
Requires=network-online.target
After=network-online.target

[Service]
Type=oneshot
Environment=BORG_PASSPHRASE_COMMAND=cat /etc/borg/local-passphrase
Environment=BORG_REMOTE_PASSPHRASE_COMMAND=cat /etc/borg/remote-passphrase
ExecStart=/usr/local/bin/borgmatic --verbosity 1 --json
ExecStartPost=/usr/local/bin/borgmatic prune --verbosity 1 --json
```

`/etc/systemd/system/borgmatic-backup.timer`:
```ini
[Unit]
Description=Daily Borgmatic Backup

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=30m

[Install]
WantedBy=timers.target
```

Enable:
```bash
systemctl daemon-reload
systemctl enable --now borgmatic-backup.timer
```

**Why systemd over cron?**
- `Persistent=true` runs immediately if the machine was off at the scheduled time
- `RandomizedDelaySec` prevents thundering herd on shared remotes
- Proper logging via `journalctl -u borgmatic-backup`
- Dependency ordering (`After=network-online.target`)

## Step 6: Monitoring with Prometheus

Install `borg_exporter` (Go binary, single file):

```bash
wget https://github.com/borgmatic-collective/borg_exporter/releases/latest/download/borg_exporter_linux_amd64 -O /usr/local/bin/borg_exporter
chmod +x /usr/local/bin/borg_exporter
```

`/etc/systemd/system/borg-exporter.service`:
```ini
[Unit]
Description=Borg Exporter
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/borg_exporter --config /etc/borg_exporter.yaml
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`/etc/borg_exporter.yaml`:
```yaml
repositories:
  - name: local
    path: /mnt/backup/borg-local
  - name: remote
    path: b2://bucket-name:path/to/repo
    env:
      - BORG_PASSPHRASE_COMMAND=cat /etc/borg/remote-passphrase
```

Scrape with Prometheus:
```yaml
- job_name: borg
  static_configs:
    - targets: ['<YOUR_HOST>:9876']
```

**Key metrics to alert on:**
- `borg_last_backup_timestamp_seconds` > 86400 (24h) → backup missed
- `borg_last_backup_duration_seconds` > 3600 → backup stuck
- `borg_repository_size_bytes` growth rate → capacity planning

## Step 7: Test Restore (Do This Now)

```bash
# List archives
borg list /mnt/backup/borg-local

# Mount and browse
mkdir /mnt/borg-test
borg mount /mnt/backup/borg-local::server1-etc-2026-08-19 /mnt/borg-test
ls /mnt/borg-test/etc/nginx/

# Extract single file
borg extract /mnt/backup/borg-local::server1-etc-2026-08-19 etc/nginx/nginx.conf

# Full disaster recovery simulation
borg extract /mnt/backup/borg-local::server1-root-2026-08-19 --destination /mnt/recovery
```

**Document the restore procedure** in your runbook. When production is down, you won't have time to read man pages.

## Retention Policy Walkthrough

With `keep_daily: 7, keep_weekly: 4, keep_monthly: 6, keep_yearly: 2`:

| Archive Age | Kept? | Reason |
|-------------|-------|--------|
| 1 day ago | Yes | Daily |
| 5 days ago | Yes | Daily |
| 10 days ago | No | Older than 7d daily |
| 3 weeks ago | Yes | Weekly |
| 2 months ago | Yes | Monthly |
| 14 months ago | Yes | Yearly |
| 3 years ago | No | Beyond 2 yearly |

Run `borgmatic prune --list --dry-run` to preview before applying.

## Common Pitfalls

| Issue | Fix |
|-------|-----|
| `borg: Error: Repository already exists` | Use `borg init` only once. Reuse existing repo. |
| `Permission denied` on remote | Check `borg serve` forced command matches repo path exactly |
| Backup takes forever | Exclude caches: `exclude_patterns: ['**/__pycache__/**', '**/node_modules/**', '**/.cache/**']` |
| Out of space on remote | Increase retention pruning frequency or upgrade storage tier |
| `borg check --repair` needed | Run `borgmatic check --repair` (requires exclusive lock) |

## Cost Breakdown (Backblaze B2 Example)

| Data | First Backup | Monthly Incremental | Monthly Cost |
|------|--------------|---------------------|--------------|
| 500 GB raw | 500 GB | ~5 GB (1% change) | $3.00 (storage) + $0.01 (egress/test) |
| 2 TB raw | 2 TB | ~20 GB | $12.00 + $0.04 |

At $5/TB/month, Borg's deduplication pays for itself in month one.

## Going Further

- **Pre-backup scripts**: Dump databases, flush Redis, snapshot LVM/ZFS
- **Post-backup verification**: `borgmatic check --verify-data` on a schedule
- **Multi-tenancy**: Separate repos per client/project with `prefix: "{hostname}-{project}-"`
- **Rclone backend**: `rclone mount remote:path /mnt/remote` then back up to local path

## Summary

BorgBackup + borgmatic gives you:
- ✅ Encrypted, deduplicated, compressed backups
- ✅ Local + remote repos with independent retention
- ✅ Systemd timers with randomized delay
- ✅ Prometheus metrics for alerting
- ✅ Mountable archives for instant file recovery
- ✅ Declarative config in `/etc/borgmatic/config.yaml`

The entire setup takes ~30 minutes. The peace of mind? Priceless.

---

*Next up: Self-Hosted Git Server with Gitea. Subscribe to get the deep dive on how I automate the entire publishing pipeline behind this blog.*