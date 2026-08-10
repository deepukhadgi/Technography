"use client";

import { useEffect } from "react";

/**
 * Decorates every <pre> block inside the rendered post with a copy button.
 * Runs once on mount (post content is static server-rendered HTML).
 * Clipboard falls back to execCommand if the async API is unavailable.
 */
export default function CodeCopyButton() {
  useEffect(() => {
    const pres = document.querySelectorAll<HTMLPreElement>(
      "article .post-content pre"
    );
    const cleanups: (() => void)[] = [];

    pres.forEach((pre) => {
      if (pre.querySelector(".copy-btn")) return; // already decorated

      pre.classList.add("relative");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "copy-btn absolute right-2 top-2 z-10 rounded border border-line bg-panel/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-dim transition-colors hover:text-accent";
      btn.textContent = "copy";
      btn.setAttribute("aria-label", "Copy code block");

      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.innerText ?? pre.innerText;
        let ok = false;
        try {
          await navigator.clipboard.writeText(code);
          ok = true;
        } catch {
          // Async clipboard can fail (non-secure context) — fall back.
          try {
            const ta = document.createElement("textarea");
            ta.value = code;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand("copy");
            ta.remove();
          } catch {
            ok = false;
          }
        }
        const original = btn.textContent;
        btn.textContent = ok ? "copied ✓" : "failed";
        btn.classList.add("text-accent");
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove("text-accent");
        }, 1500);
      });

      pre.appendChild(btn);
      cleanups.push(() => btn.remove());
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
