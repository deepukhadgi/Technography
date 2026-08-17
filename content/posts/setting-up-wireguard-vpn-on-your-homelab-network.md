---
title: "Setting Up WireGuard VPN on Your Homelab Network"
date: "2026-08-17"
excerpt: "A practical WireGuard setup for homelabbers: a lightweight VPN server on a Linux box, a Linux client, a phone client, split tunneling, and the firewall rules that keep it all working."
tags: ["vpn", "wireguard", "networking", "security"]
---

If you self-host anything, you've hit this wall: your NAS, dashboards, and
monitoring tools are only reachable *inside* your home network. Step out
the front door and they vanish. You could expose them to the internet —
please don't — or you could run a VPN and carry your private network in
your pocket. WireGuard is the fastest, simplest, and safest way to do it.

Unlike OpenVPN's sprawling configuration surface, WireGuard is a single
kernel module doing exactly one job well. It sends encrypted UDP packets
between peers, using cryptokey routing instead of a daemon plus a cert
bundle per peer. There's no TLS dance, no certificate authority, and no
handshake drama.

## What we're building

A single persistent peer on your homelab acts as the VPN "server." Every
client (laptop, phone) generates its own keypair; you paste each client's
public key into the server config, and traffic flows directly peer to peer.

```
[phone]  ---\                      /--> [dashboard]
             \-- WireGuard tunnel --/---- [NAS]
[ laptop ]            |           \---- [monitoring]
                 [homelab host]
                  (the "server")
```

The server is just the peer that stays up around the clock and hands
everyone else an address in your private tunnel range.

## Step 1: Install and generate a keypair

On your homelab host (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install wireguard
```

WireGuard manages the `wg0` interface and keys live in `/etc/wireguard/`.
Generate a keypair as root:

```bash
cd /etc/wireguard
umask 077
wg genkey | tee privatekey | wg pubkey > publickey
```

`umask 077` matters: `privatekey` must never be readable or writable by
other users. Check the public half with:

```bash
cat /etc/wireguard/publickey
```

Save that public key — you'll paste it into every client config. Your
private key stays on this host and nowhere else.

## Step 2: Write the server config

Create `/etc/wireguard/wg0.conf`:

```ini
[Interface]
Address = <YOUR_TUNNEL_IP>/24
ListenPort = 51820
PrivateKey = <YOUR_SERVER_PRIVATE_KEY>
SaveConfig = false

# client: my laptop
[Peer]
PublicKey = <LAPTOP_PUBLIC_KEY>
AllowedIPs = <YOUR_TUNNEL_IP>.2/32

# client: my phone
[Peer]
PublicKey = <PHONE_PUBLIC_KEY>
AllowedIPs = <YOUR_TUNNEL_IP>.3/32
```

Breaking that down:

- `Address` makes this peer the gateway for the private VPN subnet you are
  creating (a `/24` gives you room for 250+ peers).
- Each `[Peer]` line's `AllowedIPs` tells WireGuard "traffic destined for
  this exact address goes to this peer." The `/32` means exactly one host.
- `SaveConfig = false` stops WireGuard from rewriting the file on an
  interface restart. Leaving it on means runtime `wg` commands get silently
  memorized into your config and debugging becomes archaeology.

Note I have replaced real addresses with `<YOUR_TUNNEL_IP>` placeholders.
Pick a subnet that is **not** your normal LAN range — more on that below.

## Step 3: Bring the interface up

```bash
sudo systemctl enable --now wg-quick@wg0
```

`wg-quick` creates the interface, assigns the address, and routes the
subnet. Verify:

```bash
sudo wg show
```

You should see the public key, the listen port, and both peers with
`latest handshake: --` and `transfer: 0 B` — until a client connects.

Line 0 uses UDP port `51820`. If a firewall is running, permit it:

```bash
sudo ufw allow 51820/udp
```

That is the **only** port WireGuard ever opens. There is no HTTP admin
interface, no second service to babysit.

## Step 4: A Linux client (laptop)

On the client, install WireGuard and write `/etc/wireguard/wg0.conf`:

```ini
[Interface]
Address = <YOUR_TUNNEL_IP>.2/24
PrivateKey = <YOUR_CLIENT_PRIVATE_KEY>
DNS = <YOUR_TUNNEL_IP>.1

[Peer]
PublicKey = <YOUR_SERVER_PUBLIC_KEY>
Endpoint = <YOUR_DOMAIN>:51820
AllowedIPs = <YOUR_TUNNEL_SUBNET>
```

Three differences from the server side:

- `PrivateKey` is the client's *own* key. Never reuse the server's.
- `Endpoint` is a **public, routable** address — your domain or public IP,
  not a tunnel address. The client must reach the server before the tunnel
  exists, so this can't be the tunnel IP. If you have a dynamic public IP,
  point a DNS record at it (a free DDNS provider handles this) so the
  endpoint name stays constant.
- `AllowedIPs = <YOUR_TUNNEL_SUBNET>` routes only your homelab subnet
  through the tunnel; everything else goes out the client's ordinary
  internet. That is **split tunneling**.

On the client:

```bash
sudo wg-quick up wg0
sudo wg show
```

Then test:

```bash
ping <YOUR_TUNNEL_IP>.1
```

If it answers, the tunnel is up. Now hit an internal service by its private
address exactly as if you were on the home LAN.

## Step 5: A phone client (iOS/Android)

Same config, but a QR code turns ten fields into one scan. Install the
WireGuard app, then render the client config as a QR on the server:

```bash
sudo qrencode -t ansiutf8 < /etc/wireguard/wg0.conf
```

Scan it with the phone app, flip the switch on, and the phone becomes
`<YOUR_TUNNEL_IP>.3` with the VPN subnet routed through the tunnel. This
is the feature I use daily: a laptop cached at home, a phone that is a
clean tunnel into the house, dashboards reachable from anywhere.

## Split tunneling vs full tunnel

For a homelab you almost always want **split tunneling**: send only the
private subnet's traffic through the tunnel.

Two practical consequences:

1. Public browsing keeps your real ISP's latency and speed — your whole
   browsing history is not dumped through your home connection.
2. You can point names at your home DNS resolver for those routed domains.

To make every client send *everything* home instead, swap the peer's
`AllowedIPs` on the client:

```
AllowedIPs = 0.0.0.0/0, ::/0
```

That is a full tunnel. Only set it if you really want the homelab host to
act as your gateway to the internet — useful for ad-blocking DNS at home
all the time, so every route matches.

## The design decisions that matter

**Pick a subnet that does not overlap your LAN.** The tunnel is a *virtual*
network; if its range collides with your real LAN range, the two gateways
fight and routing goes sideways. Choose a small private block far from your
actual LAN and write it down once.

**Endpoint must be routable before the tunnel exists.** New WireGuard users
reach for the server's tunnel IP here and then spend hours wondering why
the first packet has nowhere to go. The endpoint is how the client finds
the server *first*; it must be reachable without the VPN.

**Keys are the whole authentication story.** There is no password and no
MFA. A peer is trusted because it holds the matching private key. Losing a
device? Delete its peer block, generate a fresh keypair for the replacement,
and add the new public key — the old key is dead instantly. That key
rotation story is far simpler than anything OpenVPN offers.

## Persistence and reboots

A headless server that reboots with the interface not brought back up is
the classic "worked yesterday" failure. Make it deterministic:

```bash
sudo systemctl enable --now wg-quick@wg0
sudo systemctl status wg-quick@wg0
```

After a reboot the interface comes back and existing peers re-handshake
automatically. No manual reconnect, no 3 a.m. "why can't I reach home."

## Testing the honest way

Beyond `ping`, prove the tunnel actually carries real traffic:

```bash
curl -I --max-time 8 http://<YOUR_TUNNEL_IP>:3000
```

Hit a service by its tunnel address. Now disconnect the client and confirm
the same request fails — that is proof you were not accidentally routed
over the plain internet all along.

## The one-line recap

WireGuard turns a homelab host into a private entrance: install the
module, generate a keypair, write a peer-cat config file, bring up the
interface, and reach your machines from anywhere — one narrow UDP port as
the only firewall hole, and no attack surface beyond a small encrypted
header on every packet.

The next time you say "I wish I could reach my home server from here," the
answer is a ~40-line config that took you minutes to write and then you
forgot about.