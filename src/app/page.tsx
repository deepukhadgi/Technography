import Link from "next/link";
import { getAllPosts, formatDate } from "@/lib/posts";

const skills = [
  "docker",
  "proxmox",
  "linux",
  "networking",
  "nginx",
  "node.js",
  "git/github",
  "bash",
  "python",
  "vmware/kvm",
  "self-hosting",
  "ci/cd",
];

export default function HomePage() {
  const posts = getAllPosts().slice(0, 3);

  return (
    <div className="bg-grid">
      {/* HERO */}
      <section className="mx-auto max-w-4xl px-4 pb-16 pt-20 sm:pt-28">
        <p className="font-mono text-sm text-dim">
          <span className="text-accent">$</span> whoami
        </p>
        <h1 className="mt-3 font-mono text-4xl font-bold tracking-tight sm:text-6xl">
          Deepu <span className="text-accent">Khadgi</span>
          <span className="cursor-blink text-accent">▊</span>
        </h1>
        <p className="mt-4 font-mono text-base text-cyan sm:text-lg">
          Network Engineer · networks, containers &amp; infrastructure that just
          works
        </p>
        <p className="mt-6 max-w-2xl text-dim">
          I build and operate Linux systems, virtualized environments, and
          containerized services — from home lab tinkering to production
          deployments. This site is my personal blog and lab notebook: what I
          do, what I learn, and the tech I find interesting.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 font-mono text-sm">
          <Link
            href="/blog"
            className="rounded border border-accent/60 bg-accent/10 px-4 py-3 text-accent transition-colors hover:bg-accent hover:text-bg"
          >
            read the blog →
          </Link>
          <Link
            href="/about"
            className="rounded border border-line px-4 py-3 text-dim transition-colors hover:border-accent/50 hover:text-fg"
          >
            about me
          </Link>
        </div>

        {/* SKILLS */}
        <div className="mt-16">
          <p className="font-mono text-xs text-dim">
            <span className="text-accent">$</span> ls ./skills
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {skills.map((s) => (
              <span
                key={s}
                className="rounded border border-line bg-panel px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:border-accent/50 hover:text-accent"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST POSTS */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <div className="flex items-baseline justify-between">
            <h2 className="font-mono text-lg font-bold">
              <span className="text-accent">#</span> latest posts
            </h2>
            <Link
              href="/blog"
              className="py-2 font-mono text-xs text-dim hover:text-accent"
            >
              view all →
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {posts.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/blog/${p.slug}`}
                          className="group flex flex-col rounded border border-line bg-panel p-5 transition-colors hover:border-accent/50"
                        >
                          <time className="font-mono text-xs text-dim">
                            {formatDate(p.date)}
                          </time>
                          <span className="font-mono text-xs text-dim">·</span>
                          <span className="font-mono text-xs text-dim">⏱ {p.readingTime} min read</span>
                          <h3 className="mt-2 font-mono text-sm font-bold leading-snug group-hover:text-accent">
                            {p.title}
                          </h3>
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-dim">
                            {p.excerpt}
                          </p>
                        </Link>
                      ))}
                    </div>
        </div>
      </section>
    </div>
  );
}
