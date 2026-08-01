import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

const focusAreas = [
  {
    title: "networking",
    desc: "Routing, firewalling, DNS, VPNs — the plumbing that makes everything talk to everything else.",
  },
  {
    title: "docker & containers",
    desc: "Containerized services, compose stacks, image workflows, and keeping production boring and reliable.",
  },
  {
    title: "virtualization",
    desc: "Proxmox-based VM management, resource planning, snapshots, and migrations.",
  },
  {
    title: "linux & automation",
    desc: "Day-to-day administration, shell scripting, and automating the repetitive stuff so I don't have to do it twice.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> cat ./about.txt
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        About <span className="text-accent">me</span>
      </h1>

      <div className="post-content mt-8 max-w-2xl text-sm leading-relaxed text-dim">
        <p>
          I&apos;m <span className="text-fg">Deepu Khadgi</span>, a Network
          Engineer who enjoys working across the whole stack — but especially
          the parts most people never see: the network, the servers, and the
          systems that keep services running.
        </p>
        <p className="mt-4">
          My day-to-day revolves around Linux, Docker, and virtualized
          infrastructure. I run my own home lab — virtual hosts, containers,
          self-hosted services — because I believe the best way to learn
          infrastructure is to run it yourself and break it yourself (on
          purpose, with snapshots).
        </p>
        <p className="mt-4">
          This website is part of that. It&apos;s a personal blog where I write
          about the tech I use, the problems I solve, and the things I&apos;m
          figuring out. If it helped me, it might help someone else.
        </p>
      </div>

      {/* FOCUS AREAS */}
      <h2 className="mt-14 font-mono text-lg font-bold">
        <span className="text-accent">#</span> what I work with
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {focusAreas.map((f) => (
          <div
            key={f.title}
            className="rounded border border-line bg-panel p-5"
          >
            <h3 className="font-mono text-sm font-bold text-accent">
              {f.title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-dim">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CURRENTLY */}
      <h2 className="mt-14 font-mono text-lg font-bold">
        <span className="text-accent">#</span> currently
      </h2>
      <div className="mt-6 rounded border border-line bg-panel p-5 font-mono text-sm text-dim">
        <p>
          <span className="text-accent">▸</span> Building &amp; self-hosting
          this very website (deepukhadgi.com.np)
        </p>
        <p className="mt-2">
          <span className="text-accent">▸</span> Expanding the home lab —
          services, networking, and automation
        </p>
        <p className="mt-2">
          <span className="text-accent">▸</span> Writing about networking &amp;
          infrastructure on this blog
        </p>
        <p className="mt-4 text-xs text-dim/70">
          (edit this list anytime — it&apos;s just content on the page)
        </p>
      </div>
    </div>
  );
}
