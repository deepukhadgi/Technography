---
title: "My home lab: virtual hosts, containers, and the network between them"
date: "2026-08-01"
excerpt: "How I run my home lab — a virtualization host, a Docker server, and a couple of VMs doing real work."
tags: ["homelab", "proxmox", "docker", "virtualization"]
---

A home lab is the best playground a network engineer can have. No change
requests, no change windows, no blame — just snapshots and rollbacks. Here's
how mine is laid out.

## The virtualization host

Everything runs on a single Proxmox VE host. It's modest hardware — a
mid-range desktop CPU and 8GB of RAM — but it's more than enough for the
workloads I actually care about.

Why Proxmox? It's free, open source, and it does the boring things well:
VM lifecycle, snapshots, backups, and a web UI that doesn't get in the way.
It's also what a lot of small businesses run, so the skills transfer.

## The Docker server

One of the VMs is dedicated to Docker. That's where self-hosted services
live — each in its own container, wired together with compose files. Keeping
containers on a separate VM from the hypervisor means I can rebuild the whole
service layer without touching the host.

The pattern I've settled on:

- one compose stack per service group (or per service for important ones)
- named volumes for anything that holds data
- pinned image versions, upgraded deliberately, never blindly
- health checks + restart policies so things come back on their own

## Other VMs doing real work

Beyond the Docker server there are a few more VMs, each with one job:

- a **webserver** — nginx + Node.js, which is serving this very website
- throwaway VMs I spin up to test something, then destroy

One job per VM keeps things predictable. When something breaks, you know
which box to look at.

## The network

The lab sits behind a regular home router. Internal services talk over the
LAN; only the webserver is reachable from the internet (port 80/443
forwarded to it). DNS points my domain at the public side of that router.

Lessons learned the hard way:

- document your port forwards — you will forget them
- keep the hypervisor's management interface off the public internet
- backups are not a feature, they're a habit

## Why bother?

Because running your own infrastructure teaches you things no tutorial can:
how services actually talk to each other, why resource limits matter, and
what it feels like when everything quietly keeps working because you set it
up properly.

And when it breaks at 2am, you can't file a ticket — you fix it, and you
learn something.
