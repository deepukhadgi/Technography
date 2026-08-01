import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact" };

const links = [
  {
    label: "github",
    handle: "@deepukhadgi",
    href: "https://github.com/deepukhadgi",
    desc: "Code, projects, and this website's source.",
  },
  {
    label: "linkedin",
    handle: "/in/deepu-khadgi",
    href: "https://www.linkedin.com/in/deepu-khadgi-62420616b/",
    desc: "Professional profile and work history.",
  },
  {
    label: "instagram",
    handle: "@rwomehyo",
    href: "https://instagram.com/rwomehyo",
    desc: "Photos and daily life behind the terminal.",
  },
  {
    label: "website",
    handle: "deepukhadgi.com.np",
    href: "https://deepukhadgi.com.np",
    desc: "This site — self-hosted, nginx + Node.js.",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> find . -name &quot;deepu&quot;
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Find me <span className="text-accent">online</span>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-dim">
        The best ways to reach me or follow what I&apos;m doing. A contact form
        is on the roadmap.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded border border-line bg-panel p-5 transition-colors hover:border-accent/50"
          >
            <p className="font-mono text-xs text-accent">{l.label}</p>
            <p className="mt-2 font-mono text-sm font-bold group-hover:text-accent">
              {l.handle}
            </p>
            <p className="mt-2 text-xs text-dim">{l.desc}</p>
          </a>
        ))}
      </div>

      <div className="mt-10 rounded border border-line bg-panel p-5 font-mono text-xs text-dim">
        <p>
          <span className="text-accent">$</span> whois deepu
        </p>
        <p className="mt-2">role: DevOps Engineer</p>
        <p>stack: Linux · Docker · virtualization · networking</p>
        <p>status: open to interesting problems</p>
      </div>
    </div>
  );
}
