import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import WelcomeToast from "@/components/WelcomeToast";
import SubscribeBox from "@/components/SubscribeBox";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import CodeBlockEnhancer from "@/components/CodeBlockEnhancer";
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
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/rss.xml",
    },
  },
  openGraph: {
    title: "Deepu Khadgi — Network Engineer",
    description:
      "Networks, containers, VMs, and infrastructure that just works. Personal blog about tech and the stuff I build.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash of the
            wrong theme. Dark is the default; only "light" needs a class.
            Kept in sync with src/components/ThemeProvider.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tg_theme");if(t==="light"){document.documentElement.classList.add("light");return}if(t==="dark"){return}if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){document.documentElement.classList.add("light")}}catch(e){}})();`,
          }}
        />
        <script
          async
          src={process.env.NEXT_PUBLIC_UMAMI_URL ?? "http://localhost:3000/script.js"}
          data-website-id="e3adcf3e-61c5-425b-8e2c-f828af56cfc2"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider>
          <WelcomeToast />
          <CodeBlockEnhancer />
          <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center gap-2">
              <div className="min-w-0 flex-1">
                <SiteNav />
              </div>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-line">
            <div className="mx-auto max-w-4xl px-4 py-6">
              <div className="mb-6 rounded border border-line bg-panel/50 p-4">
                <p className="font-mono text-xs text-dim">
                  <span className="text-accent">$</span> subscribe — new posts in
                  your inbox
                </p>
                <div className="mt-2 max-w-md">
                  <SubscribeBox />
                </div>
              </div>
              <div className="flex flex-col gap-2 font-mono text-xs text-dim sm:flex-row sm:items-center sm:justify-between">
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
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-dim/70">
                <a href="/rss.xml" className="hover:text-accent">rss</a>
                <a href="/sitemap.xml" className="hover:text-accent">sitemap</a>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
