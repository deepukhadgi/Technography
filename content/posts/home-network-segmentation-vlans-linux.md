---
title: "Home Network Segmentation with VLANs on Linux"
date: "2026-08-25"
excerpt: "Secure your homelab by isolating services, IoT, and guest devices using VLANs and Linux networking."
tags: ["networking", "vlan", "linux", "security"]
---

# Home Network Segmentation with VLANs on Linux

Securing a homelab starts with network segmentation. A flat network where your IoT devices, guest Wi-Fi, and critical infrastructure share the same broadcast domain is a recipe for disaster.

In this guide, I will show you how to implement VLANs on a Linux-based router to create logical separation between your services, IoT devices, and personal computers.

## The Design

We will use three distinct subnets:

1. **Management VLAN (10)**: For internal services and trusted workstations.
2. **IoT VLAN (20)**: Isolated network for smart devices.
3. **Guest VLAN (30)**: Restricted access for visitors.

*(Note: In a real-world scenario, you would map these to specific physical or virtual switch ports.)*

## Configuring Linux VLANs

On your Linux router, you can create VLAN interfaces using the `ip` command or `netplan` for persistent configurations.

### 1. Creating Interfaces

```bash
# Create VLAN 10 interface
sudo ip link add link eth0 name eth0.10 type vlan id 10

# Create VLAN 20 interface
sudo ip link add link eth0 name eth0.20 type vlan id 20

# Create VLAN 30 interface
sudo ip link add link eth0 name eth0.30 type vlan id 30
```

### 2. Assigning IP Addresses

Each VLAN needs a gateway address:

```bash
sudo ip addr add <GATEWAY_VLAN10>/24 dev eth0.10
sudo ip addr add <GATEWAY_VLAN20>/24 dev eth0.20
sudo ip addr add <GATEWAY_VLAN30>/24 dev eth0.30
```

## Firewalling

Crucially, segmentation requires firewall rules to prevent cross-VLAN traffic unless explicitly permitted. Use `nftables` or `iptables` to enforce these boundaries.

By default, drop all traffic between VLAN interfaces, and only allow established/related connections to pass from more restricted VLANs to the management VLAN.

## Summary

By adopting this structure, you significantly harden your network against lateral movement in the event of a device compromise.

---
*For more guides on securing your infrastructure, check out my other posts at <YOUR_DOMAIN>.*
