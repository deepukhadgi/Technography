---
title: "Docker Networking 101: Connecting Containers Across Services"
date: "2026-08-09"
excerpt: "Containers start out isolated from each other and from the outside world. Here's how to wire them together properly — port publishing, user-defined bridge networks, DNS by container name, and the mistakes everyone makes the first time."
tags: ["docker", "networking", "containers", "linux"]
---

You run a container. It works. You run a second container that needs to
talk to the first one — a web frontend talking to a database, say — and
suddenly nothing connects. The container that worked in isolation
refuses to see its neighbor, and the app that worked fine on your laptop
is broken in "the exact same setup."

This is the moment every Docker beginner hits, and it's not a bug in
your app. It's a networking problem, and it's completely solvable in
about ten minutes of understanding how Docker wires things up.

<figure>
  <img src="/images/docker-networking-101-diagram.png" alt="Docker Networking 101: Connecting Containers Across Services architecture diagram" width="1200" height="600" loading="lazy" />
  <figcaption class="font-mono text-xs text-dim mt-2 text-center">Docker Networking 101: Connecting Containers Across Services system diagram</figcaption>
</figure>
## Containers are isolated by default

When you `docker run` a container, Docker gives it its own network
namespace. From the container's point of view it has its own loopback
interface, its own network stack, and — by default — no way to reach
anything but the outside internet through a NAT'd bridge.

That isolation is the feature. It means a rogue process inside one
container can't sniff another container's traffic, and every service
starts from a clean slate. But it also means "localhost" is a lie: when
a process inside a container connects to `localhost`, it's talking to
its own loopback, not to the host, and not to any other container.

## Step one: port publishing with `-p`

The first thing everyone learns is the `-p` flag:

```bash
docker run -d --name web -p 8080:80 nginx
```

That publishes container port 80 on host port 8080. Requests hitting the
host's port 8080 get forwarded into the container. Two things worth
knowing about this:

- `-p 8080:80` binds **all host interfaces** by default. On a machine
  with a public IP, that means the internet can reach it. If you only
  want it reachable from the host itself, bind explicitly:
  `-p 127.0.0.1:8080:80`. This is the single most common accidental
  exposure I see in homelab setups.
- Publishing a port is not the same as a container *exposing* a port.
  The `EXPOSE` instruction in a Dockerfile is documentation; `-p` is the
  actual network rule.

## The trap: container IPs are ephemeral

So you publish the database port on the host and point your app at it.
It works — until you `docker compose up` after a reboot and the
container gets a different IP. Now your app points at a dead address.

Container IPs are assigned at creation time from the network's subnet
and are **not stable across recreations**. You should never hardcode a
container's IP anywhere. The solution is to stop addressing containers
by IP entirely and use names instead — which is exactly what Docker's
user-defined networks give you.

## Step two: user-defined networks and DNS

Create a network, then put both containers on it:

```bash
docker network create app-net
docker run -d --name db --network app-net postgres:16
docker run -d --name api --network app-net my-api
```

On a user-defined bridge network, Docker runs its own embedded DNS
server. Containers on the same network can resolve each other **by
container name**:

```bash
docker exec api ping db        # works — resolves via Docker DNS
```

No IPs, no port forwarding between containers, no host config. The `api`
container connects to `db:5432`, Docker DNS turns `db` into the right
address, and it keeps working no matter how many times either container
is recreated.

There are two flavors of the built-in bridge:

- The **default bridge** (`docker0`): what you get with plain
  `docker run` and no `--network`. It has *no* automatic DNS — you can
  only reach other containers by IP. Fine for one container, wrong tool
  for anything with two services.
- **User-defined bridges**: what `docker network create` makes. DNS by
  name, and containers can be attached and detached at any time. This is
  the default choice for multi-service setups.

Use `--network-alias` when you want a stable name that doesn't change if
the container is renamed:

```bash
docker run -d --name api-v2 --network app-net --network-alias api my-api
```

## Compose: networking for free

If you use `docker compose`, this all happens automatically. Every
service in the file joins the project's default network and is reachable
by its service name:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: myapp
    volumes:
      - db-data:/var/lib/postgresql/data
    # no ports section needed — only the API talks to the database

  api:
    build: .
    ports:
      - "127.0.0.1:8080:3000"   # only reachable from the host
    depends_on:
      - db

volumes:
  db-data:
```

Note what's *missing*: the database publishes no ports. Nothing outside
the Compose network can reach it, because nothing outside needs to. The
API reaches it at `db:5432` — the hostname `db` is the service name.
This is the "internal by default" model, and it's worth keeping it that
way: publish only what must be reachable from outside.

## Keeping networks truly internal

Sometimes you want a network that *nothing* can reach from outside —
workers, caches, background job queues:

```bash
docker network create --internal jobs-net
docker run -d --name worker --network jobs-net my-worker
```

An `--internal` network has no route to the outside world at all. The
worker can talk to other containers on `jobs-net` but can't reach the
internet — useful when a compromised worker is the thing you're trying
to contain.

For extra credit, connect a container to two networks: one internal for
databases, one with a published port for the outside. Network
separation at the container level is cheap and buys real isolation.

## The pitfalls that burn everyone

**"Why can't my app reach localhost?"** Because inside the container,
localhost is the container. Point your app at the *service name*
(`db`, `redis`) on a shared network, or at the host gateway if it must
reach something running on the host itself — use the special hostname
`host.docker.internal` in Docker Desktop, or the host's bridge gateway
address on Linux.

**Race conditions on startup.** `depends_on` only waits for a container
to *start*, not for the service inside it to be *ready*. Postgres can
still be initializing when your API connects. Add a healthcheck and wait
for it:

```yaml
services:
  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp"]
      interval: 5s
      timeout: 3s
      retries: 10
```

**Everything works, then breaks on reboot.** Container IPs changed and
something hardcoded one. Fix it properly: no hardcoded addresses, rely
on Docker DNS, and re-create the network's consumers when topology
changes.

**Binding to all interfaces.** `-p 8080:80` on a host with a public
address is a web server exposed to the internet whether you planned it
or not. If you're not sure a port needs to be public, bind it to
`127.0.0.1` and reverse-proxy it — nginx in front, containers behind.
This is the pattern I use everywhere: only the proxy publishes a port,
everything else is internal.

## Verifying your topology

`docker network inspect` shows you the full picture:

```bash
docker network inspect app-net
```

It lists every attached container, its address, and its aliases. And
`docker exec` lets you test resolution exactly the way your app will:

```bash
docker exec api getent hosts db
```

If that resolves, your containers can talk. If it doesn't, the
containers aren't on the same network — the #1 cause of "works in
isolation, broken together."

## The mental model

Three rules cover 95% of container networking:

1. Put services that talk to each other on the **same user-defined
   network** and address them **by name**.
2. Publish ports only for what the outside world must reach — and bind
   to `127.0.0.1` when in doubt.
3. Never write down a container IP. If you find yourself doing it,
   stop and add a network alias instead.

That's the whole trick. Isolation is the default; a bridge network and
DNS-by-name is the fix; and the result is services that survive
recreates, reboots, and the chaos of a real homelab.
