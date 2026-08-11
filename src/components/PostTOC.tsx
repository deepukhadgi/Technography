"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

type Heading = { id: string; text: string; level: 2 | 3 };

/**
 * Table of contents sidebar (client component).
 *
 * Parses the rendered post HTML (`contentHtml`) for h2/h3 headings on mount
 * and renders a sticky, internally-scrollable "contents" box on lg+ screens
 * (hidden on mobile/md). The section currently in view is highlighted via
 * IntersectionObserver; clicking an entry smooth-scrolls to the heading and
 * updates the URL hash.
 *
 * Implementation notes:
 * - remark-html does not emit heading ids (no remark-slug in the pipeline),
 *   so this component assigns stable ids to the live DOM headings itself,
 *   matching the conventional slug format (lowercase, spaces → hyphens,
 *   special chars stripped) and deduping collisions.
 * - Scoped to `article .post-content` (same selector CodeCopyButton uses),
 *   so headings outside the post body (lockbox, comments, related) are
 *   ignored; on premium-locked posts there is no such container and the
 *   component renders nothing.
 * - The aside shell is always mounted (hidden below lg) so the two-column
 *   flex layout in the post page doesn't shift once the list fills in after
 *   hydration.
 */
export default function PostTOC({ contentHtml }: { contentHtml: string }) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const headingEls = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const container = document.querySelector("article .post-content");
    // No post content on the page (e.g. premium-locked for a non-subscriber):
    // headings stay empty and the sidebar renders nothing.
    if (!container) return;

    // Defer the DOM scan by one frame so layout is settled, and so the
    // setState happens in a callback rather than the synchronous effect
    // body (react-hooks/set-state-in-effect).
    let observer: IntersectionObserver | null = null;
    const rafId = window.requestAnimationFrame(() => {
      // Parse heading texts from the rendered HTML string (DOMParser — the
      // component only has the serialized markup, not the live tree).
      const doc = new DOMParser().parseFromString(contentHtml, "text/html");
      const skippable = (el: Element) =>
        el.closest("pre, code, blockquote") !== null;
      const parsed = [...doc.querySelectorAll("h2, h3")]
        .filter((h) => !skippable(h))
        .map((h) => ({
          level: h.tagName === "H3" ? (3 as const) : (2 as const),
          text: (h.textContent ?? "").trim(),
        }));

      // Match them to the live DOM headings (same source, same order) and
      // assign stable ids so anchors and the scroll-spy share one set.
      const live = [...container.querySelectorAll("h2, h3")].filter(
        (el) => !skippable(el)
      );
      const used = new Map<string, number>();
      const els: HTMLElement[] = [];
      const items: Heading[] = [];

      live.forEach((el, i) => {
        const text = parsed[i]?.text || (el.textContent ?? "").trim();
        const base = el.id || slugify(text) || `section-${i + 1}`;
        const count = used.get(base) ?? 0;
        used.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        el.id = id;
        (el as HTMLElement).style.scrollMarginTop = "1rem";
        els.push(el as HTMLElement);
        items.push({
          id,
          text,
          level: parsed[i]?.level ?? (el.tagName === "H3" ? 3 : 2),
        });
      });

      setHeadings(items);
      headingEls.current = els;

      if (els.length === 0) return;

      // Scroll-spy: a heading is "active" while it sits in the top band of
      // the viewport; once every heading has scrolled past it, keep the last
      // one highlighted instead of dropping to none.
      observer = new IntersectionObserver(
        (entries) => {
          const intersecting = entries.filter((e) => e.isIntersecting);
          if (intersecting.length > 0) {
            let best = intersecting[0];
            for (const e of intersecting) {
              if (e.boundingClientRect.top < best.boundingClientRect.top) {
                best = e;
              }
            }
            setActiveId((best.target as HTMLElement).id);
          } else {
            let current: HTMLElement | null = null;
            for (const el of headingEls.current) {
              if (el.getBoundingClientRect().top <= 0) current = el;
              else break; // headings are in document order
            }
            setActiveId(current?.id ?? null);
          }
        },
        { rootMargin: "0px 0px -70% 0px", threshold: 0 }
      );
      els.forEach((el) => observer!.observe(el));

      // If the user landed on a #hash, honor it now that ids exist (the
      // browser couldn't scroll to it before mount).
      const hash = window.location.hash.slice(1);
      if (hash) {
        const target = document.getElementById(hash);
        if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
      }
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [contentHtml]);

  const handleClick = (e: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  };

  return (
    <aside className="hidden lg:block lg:w-[30%] lg:self-stretch">
      {headings.length > 0 && (
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded border border-line bg-panel p-4">
          <p className="font-mono text-xs text-dim">contents</p>
          <nav aria-label="Table of contents" className="mt-3">
            <ul className="space-y-1">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    onClick={(e) => handleClick(e, h.id)}
                    aria-current={h.id === activeId ? "location" : undefined}
                    className={`block py-0.5 font-mono text-xs leading-snug transition-colors ${
                      h.id === activeId
                        ? "text-accent"
                        : "text-dim hover:text-fg"
                    } ${h.level === 3 ? "pl-3" : ""}`}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </aside>
  );
}

/** Lowercase, spaces → hyphens, special chars stripped — the same slug
 *  format remark-based heading ids conventionally use. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
