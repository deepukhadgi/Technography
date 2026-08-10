"use client";

import { useEffect } from "react";

// Module-level guard: even if React ever double-mounts this component
// (StrictMode in dev, hydration recovery, etc.), each <pre> gets decorated
// exactly once.
const decorated = new WeakSet<HTMLElement>();

/**
 * Decorates every <pre> block inside the rendered post with a copy button.
 * Runs once on mount (post content is static server-rendered HTML).
 * - Idempotent: guarded by WeakSet + .copy-btn check (no duplicates ever).
 * - Overlap-free: measures the code's first line and adds top padding to
 *   the block only when the button would cover text (e.g. single-line
 *   blocks where the button previously sat on top of the code, reading as
 *   "a button inside a button").
 * - Clipboard falls back to execCommand if the async API is unavailable.
 */
export default function CodeCopyButton() {
  useEffect(() => {
    const pres = document.querySelectorAll<HTMLPreElement>(
      "article .post-content pre"
    );
    const cleanups: (() => void)[] = [];

    pres.forEach((pre) => {
      if (decorated.has(pre) || pre.querySelector(".copy-btn")) return;
      decorated.add(pre);

      pre.classList.add("relative");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "copy-btn absolute right-2 top-2 z-10 rounded border border-line bg-panel px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-dim shadow-lg shadow-black/20 transition-colors hover:text-accent";
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

      // Push the first code line below the button if it would overlap
      // (measure actual rects — works with any theme/padding).
      const codeEl = pre.querySelector("code");
      if (codeEl) {
        const preRect = pre.getBoundingClientRect();
        const codeRect = codeEl.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        const btnBottomOverlap = btnRect.bottom - codeRect.top;
        if (btnBottomOverlap > 0) {
          const currentPad = parseFloat(getComputedStyle(pre).paddingTop) || 0;
          pre.style.paddingTop = `${currentPad + btnBottomOverlap + 4}px`;
        }
        void preRect;
      }

      cleanups.push(() => btn.remove());
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
