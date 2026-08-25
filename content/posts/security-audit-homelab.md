---
title: "Security Audit of My Own Homelab: What I Found and Fixed"
date: "2026-08-25"
excerpt: "A behind-the-scenes look at a recent security audit I conducted on my own infrastructure and the vulnerabilities I addressed."
tags: ["security", "audit", "homelab", "vulnerabilities", "subscriber-only"]
premium: true
---

# Security Audit of My Own Homelab: What I Found and Fixed

As someone who spends all day configuring and hardening infrastructure, it is easy to assume my own homelab is bulletproof. Recently, I decided to stop assuming and start verifying. I conducted a comprehensive security audit of my own environment, and the results were humbling.

Here is what I found and how I fixed it.

## The Scope of the Audit

My goal was to look at my homelab through the eyes of an attacker. I focused on:

1. **Network Exposure:** What services are exposed to the public internet?
2. **Access Control:** Reviewing SSH configurations, user permissions, and password policies.
3. **Container Security:** Are my Docker containers running as root? What are their base images?

## Key Vulnerabilities Found

### 1. Neglected Password Policies
Even though I disabled root login, I still had password authentication enabled for a non-root user. This is a classic "low-hanging fruit" vulnerability that I had neglected for too long.

### 2. Exposed Internal Dashboard
One of my internal monitoring dashboards was accidentally mapped to a public-facing port, bypassing my primary reverse proxy authentication.

## Remediations

I moved quickly to address these issues:

- **SSH Hardening:** I disabled password authentication entirely across all instances. From now on, key-based authentication is the only option.
- **Reverse Proxy Lockdown:** I reconfigured my reverse proxy to enforce strict authentication for all services, including internal dashboards.
- **Container Cleanup:** I initiated a project to move all container workloads to run as non-root users.

## Takeaway

Security is not a "set and forget" configuration; it's a process. Regularly auditing your own infrastructure is the only way to catch configuration drift and human errors before they become exploits.

---
*If you are a subscriber, thank you for supporting this blog. Stay tuned for more deep dives into my infrastructure and workflows.*
