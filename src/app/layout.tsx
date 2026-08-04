import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Deepu Khadgi — Network Engineer",
    template: "%s — Deepu Khadgi",
  },
  description:
    "Personal site and blog of Deepu Khadgi, a network engineer writing about Linux, Docker, virtualization, networking, and self-hosting.",
  metadataBase: new URL("https://deepukhadgi.com.np"),
  openGraph: {
    title: "Deepu Khadgi — Network Engineer",
    description:
      "Networks, containers, VMs, and infrastructure that just works. Personal blog about tech and the stuff I build.",
    type: "website",
  },
};

const navLinks = [
  { href: "/", label: "home" },
  { href: "/about", label: "about" },
  { href: "/blog", label: "blog" },
  { href: "/contact", label: "contact" },
  { href: "/signup", label: "signup" },
  { href: "/login", label: "login" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 font-mono text-sm">
            <Link href="/" className="font-bold tracking-tight">
              <span className="text-accent">deepu</span>
              <span className="text-dim">@</span>
              <span className="text-fg">dev</span>
              <span className="text-dim">:~$</span>
            </Link>
            <div className="flex items-center gap-5">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-dim transition-colors hover:text-accent"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-6 font-mono text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="text-accent">$</span> echo &quot;© 2026 Deepu
              Khadgi&quot;
            </p>
            <p className="flex items-center gap-3">
              <a
                href="https://github.com/deepukhadgi"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                github
              </a>
              <span className="text-line">|</span>
              <a
                href="https://www.linkedin.com/in/deepu-khadgi-62420616b/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                linkedin
              </a>
              <span className="text-line">|</span>
              <a
                href="https://instagram.com/rwomehyo"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-accent"
              >
                instagram
              </a>
              <span className="text-line">|</span>
              <span>self-hosted with ❤</span>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
