import type { Metadata } from "next";

export const metadata: Metadata = { title: "Uses" };

type UseItem = {
  label: string;
  desc: string;
};

type UseSection = {
  title: string;
  items: UseItem[];
};

const sections: UseSection[] = [
  {
    title: "hardware",
    items: [
      {
        label: "Workstation",
        desc: "Custom built PC — the control center of the whole homelab setup.",
      },
      {
        label: "Servers",
        desc: "Virtual machines managed by Proxmox VE — everything runs on VMs, nothing on bare metal.",
      },
      {
        label: "Network",
        desc: "Managed switch, dual-band WiFi, and wired backhaul between the important bits.",
      },
    ],
  },
  {
    title: "software & os",
    items: [
      {
        label: "OS",
        desc: "Ubuntu Server (latest LTS) on every VM — boring, stable, well-documented.",
      },
      {
        label: "Containerization",
        desc: "Docker + Docker Compose for running services as reproducible stacks.",
      },
      {
        label: "Proxy",
        desc: "Nginx reverse proxy with TLS termination in front of every service.",
      },
      {
        label: "CDN / Proxy",
        desc: "Cloudflare for DNS, proxying, security headers, and SSL.",
      },
    ],
  },
  {
    title: "development",
    items: [
      {
        label: "Language",
        desc: "TypeScript — static types keep the refactors sane.",
      },
      {
        label: "Framework",
        desc: "Next.js with the App Router, compiled to standalone output.",
      },
      {
        label: "Styling",
        desc: "Tailwind CSS plus a custom dark/light theme system.",
      },
      {
        label: "Editor",
        desc: "VS Code — with the usual mountain of extensions.",
      },
      {
        label: "Version Control",
        desc: "Git + GitHub for everything, including this site.",
      },
    ],
  },
  {
    title: "infrastructure",
    items: [
      {
        label: "VM Management",
        desc: "Proxmox VE — snapshots, migrations, and templates for the whole lab.",
      },
      {
        label: "Database",
        desc: "PostgreSQL for the data that matters.",
      },
      {
        label: "Search",
        desc: "Meilisearch for fast, typo-tolerant full-text search.",
      },
      {
        label: "Analytics",
        desc: "Umami — self-hosted, privacy-first, no cookie banners needed.",
      },
      {
        label: "Newsletter",
        desc: "Listmonk, self-hosted, for the newsletter.",
      },
      {
        label: "Email",
        desc: "Postfix with SMTP2GO as the relay for transactional email.",
      },
      {
        label: "AI Gateway",
        desc: "Custom LLM router exposing an OpenAI-compatible API to self-hosted apps.",
      },
    ],
  },
  {
    title: "this site",
    items: [
      {
        label: "Deployed on",
        desc: "A self-hosted VPS behind Cloudflare — full control, no managed hosting.",
      },
      {
        label: "CI/CD",
        desc: "Manual deploy via a script: build, copy, restart. Simple on purpose.",
      },
      {
        label: "Monitoring",
        desc: "Uptime checks plus Umami analytics for traffic and performance signals.",
      },
    ],
  },
];

export default function UsesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <p className="font-mono text-sm text-dim">
        <span className="text-accent">$</span> cat ./uses.txt
      </p>
      <h1 className="mt-3 font-mono text-3xl font-bold sm:text-4xl">
        Uses <span className="text-accent">/</span>
      </h1>

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-dim">
        What I use to build and run this site and my homelab. Nothing
        sponsored, nothing fancy — just the tools that work.
      </p>

      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mt-14 font-mono text-lg font-bold">
            <span className="text-accent">#</span> {section.title}
          </h2>
          <div className="mt-5 rounded border border-line bg-panel p-5 font-mono text-sm text-dim">
            <ul className="space-y-3">
              {section.items.map((item) => (
                <li key={item.label}>
                  <span className="text-accent">▸</span>{" "}
                  <strong className="font-bold text-fg">{item.label}:</strong>{" "}
                  {item.desc}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}

      <p className="mt-16 border-t border-line pt-6 font-mono text-xs text-dim">
        <span className="text-accent">$</span> last updated: August 2026
      </p>
    </div>
  );
}
