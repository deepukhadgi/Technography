---
title: "Setting Up Proxmox VE for a Multi-VM Homelab"
date: "2026-08-13"
excerpt: "From bare-metal install to a running homelab — the exact steps I took to set up Proxmox VE, create VMs, and connect everything with a clean network layout."
tags: ["proxmox", "virtualization", "homelab", "linux"]
---

A homelab without virtualization is just a fancy server. The moment you add Proxmox, you get snapshots, live migration, template cloning, and a web UI that actually makes sense. I've been running mine for over a year now, and it's the single most important piece of infrastructure I own.

This is the guide I wish I'd had before my first install. No fluff — just the steps, the decisions, and the reasons behind them.

## Why Proxmox Instead of Docker Compose?

Docker is great for single services. But when you need isolated VMs with different OSes, GPU passthrough, or full kernel access, containers fall short. Proxmox (based on Debian Linux) gives you:

- **Full VMs** with KVM — run anything from Alpine to Windows
- **LXC containers** — lightweight, near-native performance
- **Snapshots and clones** — break something? Roll back in seconds
- **Web UI at port 8006** — manage everything from a browser
- **ZFS support** — built-in deduplication, compression, and snapshots

My homelab runs on a single <YOUR_HOST> machine with 12 cores and 32 GB RAM. That's enough for five VMs and three LXCs without breaking a sweat.

## Step 1 — Install Proxmox VE

Download the ISO from [proxmox.com](https://www.proxmox.com/en/downloads) and flash it to a USB drive with `dd` or Etcher. Boot from it and follow the installer. A few notes:

- **Target disk**: Pick the drive you want Proxmox on. This wipes it completely.
- **Password**: Set a strong root password. You'll use it for the CLI and the web UI.
- **Network**: The installer configures a bridge (`vmbr0`) automatically. Accept the defaults unless you have a special setup.
- **Email**: Skip it unless you want alert emails. You can configure that later.

After the install, the machine boots into Proxmox. Grab the IP address from the console (it's printed at the bottom), then open `https://<YOUR_HOST>:8006` in a browser. Log in with `root` and your password.

## Step 2 — Configure the Network

Proxmox creates a default bridge called `vmbr0`. All VMs and containers attach to it and get IPs from your home router's DHCP server. This is usually exactly what you want.

If you need static IPs for your lab machines (and you do — DHCP drift is a pain), set them up inside each VM's guest OS rather than on the host. Proxmox itself should keep its management IP static, configured in `/etc/network/interfaces`:

```
auto vmbr0
iface vmbr0 inet static
    address <YOUR_HOST_IP>/24
    gateway <YOUR_GATEWAY_IP>
    bridge-ports enp1s0
    bridge-stp off
    bridge-fd 0
```

Replace the IP, gateway, and interface name with your own. Then run `systemctl restart networking`.

## Step 3 — Create Your First VM

Click **Create VM** in the web UI. Here's the config I use for every Linux VM in my lab:

| Setting | Value | Why |
|---------|-------|-----|
| OS | Linux 6.x / 5.x (2048 MB) | Modern kernel, good container support |
| CPU | 2 sockets, 2 cores each | Starts at 4 vCPUs; scale up later |
| Memory | 4096 MB | Enough for most services |
| Hard disk | 32 GB SCSI | Fast, thin-provisioned on ZFS |
| Network | VirtIO, bridge vmbr0 | Best performance for Linux guests |
| Cloud-init | Enabled | Auto-configure network and SSH on first boot |

For the cloud-init disk, Proxmox can auto-generate a small ISO with your SSH key and network config. This means the VM boots, picks up an IP via DHCP, and you can SSH into it immediately — no monitor needed.

## Step 4 — Install the Guest OS

Boot the VM and install your distro of choice. I use Ubuntu Server for most services because of the documentation and Docker support. During installation:

- Create a non-root user with sudo privileges
- Install the OpenSSH server
- Let the installer handle the rest

After the install, shut down the VM. This is your base template.

## Step 5 — Take a Snapshot and Clone

Right-click the VM → **Snapshot** → name it `clean-install`. Now you have a restore point.

To create a new VM from this template: right-click → **Clone** → select **Full clone** (not linked). A full clone is independent — you can modify it without affecting the template. Linked clones save space but share the base disk, which limits what you can do.

I typically clone the template for each new service: one VM for the web server, one for the database, one for the AI gateway. Each gets a unique static IP and hostname inside its guest OS.

## Step 6 — Set Up Storage

Proxmox supports several storage backends. The default is `local` (your SSD/HDD). For a lab, I recommend adding a second storage pool for VM disks:

1. Format a second drive with ZFS: `zpool create vmstorage /dev/sdb`
2. In the Proxmox UI: **Datacenter** → **Storage** → **Add** → **ZFS** → point it at the new pool
3. Set it as the default for new VMs

ZFS gives you compression (transparent, ~20-30% space savings on VM disks) and instant snapshots. It's worth the extra disk.

## Step 7 — Network Layout

Here's the layout I use for my homelab:

```
Router (<YOUR_GATEWAY_IP>)
    │
    ├── proxmox-host (<YOUR_HOST_1>)
    │   ├── VM 100 — AI gateway (<YOUR_HOST_2>)
    │   ├── VM 101 — Agent runner (<YOUR_HOST_3>)
    │   └── LXC  — Build runner
    │
    ├── proxmox-host-2 (<YOUR_HOST_4>)
    │   ├── VM 100 — Docker services (<YOUR_HOST_5>)
    │   └── VM 101 — Web server + nginx (<YOUR_HOST_6>)
    │
    └── Any other device on the LAN
```

Each VM gets a static IP on the same LAN segment. The router handles DHCP for everything else. This means I can reach any service by hostname or IP from anywhere in the house.

## Step 8 — Security Basics

A homelab is still exposed to your home network, which means it's exposed to the internet through your router. A few basics:

- **Change the default root password** and disable password login for SSH on all VMs
- **Enable the firewall** on each VM: `sudo ufw default deny incoming && sudo ufw allow 22/tcp && sudo ufw enable`
- **Install fail2ban**: `sudo apt install fail2ban && sudo systemctl enable fail2ban`
- **Keep Proxmox updated**: `apt update && apt upgrade -y` on the host, and inside each VM
- **Use SSH keys only** — no password authentication anywhere

## Step 9 — What's Next

With Proxmox running and a few VMs cloned, you have a foundation for anything. Add a Docker host VM for containerized services, set up a file server VM, or dedicate one to running AI models. The beauty is that each VM is isolated — a broken config in one doesn't take down the others.

My next step after getting Proxmox running was to automate everything with a script that clones templates, provisions VMs, and sets up networking on demand. That's a story for another post.

The takeaway: Proxmox turns a single machine into a full lab. Snapshots make experimentation safe, cloning makes provisioning fast, and the web UI makes management easy. Install it, clone a template, and start building.
