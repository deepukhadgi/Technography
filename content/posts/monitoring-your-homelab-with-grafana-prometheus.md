---
title: "Monitoring Your Homelab with Grafana + Prometheus"
date: "2026-08-16"
excerpt: "Your homelab is only as good as what you can see. Here's how to set up Prometheus to scrape metrics and Grafana to turn them into dashboards you'll actually look at — all in Docker, all under 30 minutes."
tags: ["monitoring", "grafana", "prometheus", "homelab"]
---

You bought the hardware. You wired the cables. Your services are running. But you have no idea if anything is broken — until someone messages you saying "the WiFi is down" or your mail server hasn't sent a single message in three days.

This is the problem monitoring solves. Not fancy AIOps. Not enterprise alerting platforms. Just: **is it alive, and if not, why?**

Prometheus and Grafana are the standard answer. Prometheus collects metrics — numbers over time. Grafana draws them. Together they give you a single pane of glass for your entire homelab. And you can run both in Docker on the same machine that's already hosting your other services.

## What Prometheus actually is

Prometheus is a time-series database. That's it. It doesn't care about your applications, your containers, or your feelings. It stores numbers tagged with labels and queried by time range.

```
cpu_usage_seconds_total{job="node",instance="<YOUR_HOST>"} 42.7
memory_available_bytes{job="node",instance="<YOUR_HOST>"} 3222715392
```

That's all Prometheus knows. The first line says: the CPU has been busy for 42.7 seconds total on the monitored host. The second says 3.2 GB of memory is still available. Nothing fancy. Just numbers with context.

The "context" comes from **labels** — key-value pairs that describe the metric. `job` tells you what's being measured. `instance` tells you which machine. You can add more: `service="postgres"`, `host="rack-1"`. Prometheus indexes them, so queries are fast even with millions of data points.

## The scraping model

Most monitoring tools work the other way: you push metrics to them. Prometheus pulls. It has a list of **targets** — endpoints that expose a `/metrics` path — and it scrapes them on a schedule. Every 15 seconds, every minute, whatever you configure.

```
$ curl http://<YOUR_HOST>:9100/metrics
# HELP up Whether the target is up.
# TYPE up gauge
up 1
# HELP node_cpu_seconds_total Total CPU seconds.
# TYPE node_cpu_seconds_total counter
node_cpu_seconds_total{cpu="0",mode="idle"} 12345.67
```

The exporter (in this case, `node_exporter`) runs on the target machine, collects the data, and serves it at `/metrics`. Prometheus scrapes it. No agents, no daemons, no complexity. The target just exposes a URL.

This is the model that makes it work at home. Your containers already expose health checks, metrics endpoints, or you install a lightweight exporter. Prometheus comes to you.

## Docker Compose: three services, one file

Here's the whole stack. Prometheus, Grafana, and `node_exporter` for the host metrics.

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "127.0.0.1:9090:9090"
    volumes:
      - ./prometheus:/etc/prometheus
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=CHANGE_ME
      - GF_USERS_ALLOW_SIGN_UP=false

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "127.0.0.1:9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($|/)'
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
```

Two things to notice:

**Ports bind to `127.0.0.1`.** Prometheus, Grafana, and node_exporter are all on `127.0.0.1` — not `0.0.0.0`. This means they're only reachable from the host machine, not from the internet. If you want to access Grafana from outside, you put nginx in front of it and reverse-proxy to `127.0.0.1:3000`. Never expose these ports directly.

**The retention is 30 days.** Prometheus stores everything locally. After 30 days, old data rolls off. For a homelab with a handful of targets, 30 days is plenty — you're not generating millions of data points per second. If you ever need more, you add a long-term storage backend, but that's a problem for production-scale monitoring.

## Prometheus configuration

The `prometheus.yml` file lives in `./prometheus/` on your host (mounted into the container). This is where you tell Prometheus what to scrape.

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'docker'
    static_configs:
      - targets: ['host.docker.internal:9323']
```

The `job_name` is the label Prometheus uses to group metrics. `node` pulls from node_exporter. `docker` pulls from the Docker daemon's metrics endpoint (if enabled). `prometheus` is self-monitoring — Prometheus scraping itself so you can see if *it* is healthy.

For a bigger homelab, you'd add more jobs: one for each service that exposes metrics. Your Next.js app? It has its own `/metrics` endpoint. Your database? Most have a Prometheus exporter or an existing one you can use.

## Adding Grafana dashboards

Grafana starts empty. You create dashboards by querying Prometheus, then save the result.

The first thing you want is **the node exporter dashboard**. It shows CPU, memory, disk, network — everything a system administrator needs. You can import it directly:

1. Open Grafana at `http://<YOUR_HOST>:3000` (log in with the password you set in the compose file — default is `admin` / whatever you configured).
2. Go to **Connections → Data Sources → Add data source → Prometheus**.
3. Set the URL to `http://prometheus:9090`. Click **Save & test**.
4. Go to **Dashboards → Import**, paste dashboard ID `1860` (the official Node Exporter Full dashboard), and click **Import**.

That's it. You now have a dashboard with 30+ panels showing everything about your host: CPU usage per core, memory breakdown, disk I/O, network throughput, temperature, load average.

For a quick start, here are the three dashboards I always import:

| Dashboard | ID | What it shows |
|-----------|-----|---------------|
| Node Exporter Full | 1860 | Every system metric you'll ever need |
| Prometheus Dashboard | 3665 | Prometheus itself — scrapes, storage, errors |
| Docker and Pod Metrics | 13520 | Container-level CPU, memory, network |

## The alerting piece

Monitoring is observation. Alerting is **knowing when something breaks**. Prometheus has a built-in alerting system called Alertmanager.

Here's a minimal configuration that sends alerts to your Telegram:

```yaml
# In prometheus.yml, add at the bottom:
rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

```yaml
# In ./prometheus/alerts.yml:
groups:
  - name: homelab
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU on {{ $labels.instance }}"
          description: "CPU usage is above 80% for 10 minutes."

      - alert: DiskSpaceRunningLow
        expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"
          description: "Disk usage is above 85%."
```

The `expr` is a PromQL query — Prometheus's query language. `100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` calculates the average CPU usage across all cores over the last 5 minutes, expressed as a percentage. If it stays above 80 for 10 minutes, the alert fires.

For Telegram notifications, I use a simple bridge: Alertmanager sends to a webhook, and a small script forwards it to Telegram. Or you can use the built-in webhook integration with a bot. The exact setup depends on your preference — the important part is that Prometheus knows when to alert, and something delivers the alert.

## A note on "should I monitor my homelab?"

Your homelab isn't a production cluster. You have four services, not four hundred. Do you really need metrics?

Yes, because the alternative is **reactive troubleshooting**. Something breaks, you SSH in, check logs, restart, hope it sticks. You lost hours. With monitoring, you get a graph showing exactly when CPU spiked or disk filled up. You fix it in minutes instead of hours.

And it's not hard. Thirty minutes to set up, fifteen megabytes of RAM for Prometheus, and you have visibility into your entire infrastructure that most production teams would pay thousands for.

The hardest part isn't the tooling. It's building the habit of actually looking at the dashboards. Set up a morning routine: coffee, dashboard check, notice anything red, investigate. Five minutes a day catches problems before they become outages.

## Where to go from here

You now have Prometheus collecting metrics and Grafana displaying them. That's 90% of the value. The remaining 10% is tuning:

- **Add more exporters.** Your database, your app, your reverse proxy — most have ready-made exporters.
- **Set up alerting.** Start with disk space and CPU. Add memory, network, and service-specific alerts as you go.
- **Create custom dashboards.** The Node Exporter dashboard shows everything. Your own dashboards should show what *you* care about: "is my blog up?" "is my mail queue growing?"
- **Historical trends.** After a month of data, you'll see patterns. CPU every evening at 8 PM. Disk growing by 2 GB per week. These insights are invisible without historical data.

The stack runs on the same machine as everything else. If it breaks, you still have your other services running — and you'll know exactly why, because you're looking at the graphs.
