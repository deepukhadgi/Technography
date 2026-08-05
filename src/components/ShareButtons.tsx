"use client";

import { useState } from "react";

/**
 * Share buttons row (client component — needs onClick for copy-link).
 * Rendered by the server post page; the copy handler must live on the
 * client, which is why this whole row is a client component.
 */
export default function ShareButtons({
  title,
  slug,
}: {
  title: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);
  const postUrl = `https://deepukhadgi.com.np/blog/${slug}`;

  const links = [
    {
      label: "x",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(postUrl)}`,
    },
    {
      label: "linkedin",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`,
    },
    {
      label: "whatsapp",
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} — ${postUrl}`)}`,
    },
  ];

  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6 font-mono text-xs text-dim">
      <span className="text-accent">share:</span>
      {links.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:text-accent hover:underline"
        >
          {s.label}
        </a>
      ))}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(postUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="underline-offset-4 hover:text-accent hover:underline"
      >
        {copied ? "copied!" : "copy link"}
      </button>
    </div>
  );
}
