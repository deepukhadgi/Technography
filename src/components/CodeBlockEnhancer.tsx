"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const WRAPPER_CLASS = "code-block";
const COPIED_CLASS = "text-accent";
const BTN_CLASS =
  "absolute top-2 right-2 z-10 h-7 cursor-pointer select-none rounded border border-line bg-panel/90 px-2 font-mono text-[10px] text-dim transition-colors hover:border-accent/60 hover:text-accent";

/**
 * Wrap a single <pre> in a relative container with a copy button.
 * Idempotent: skips blocks already wrapped (marked by .code-block).
 * Mutating the DOM around dangerouslySetInnerHTML content is safe — React
 * treats that subtree as opaque and never reconciles it.
 */
function wrapBlock(pre: HTMLPreElement): void {
  if (pre.parentElement?.classList.contains(WRAPPER_CLASS)) return;

  const wrapper = document.createElement("div");
  wrapper.className = `${WRAPPER_CLASS} relative group`;
  pre.parentNode?.insertBefore(wrapper, pre);
  wrapper.appendChild(pre);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  btn.setAttribute("aria-label", "copy code");
  btn.title = "copy code";
  btn.textContent = "copy";
  wrapper.appendChild(btn);

  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  btn.addEventListener("click", () => {
    void copyText(pre.textContent ?? "").then(() => {
      btn.textContent = "copied!";
      btn.classList.add(COPIED_CLASS);
      if (copiedTimer) clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        btn.textContent = "copy";
        btn.classList.remove(COPIED_CLASS);
      }, 1500);
    });
  });
}

/** Add copy buttons to every code block currently in the DOM. */
function enhance(): void {
  document.querySelectorAll<HTMLElement>("pre code").forEach((code) => {
    const pre = code.closest("pre");
    if (pre) wrapBlock(pre);
  });
}

/**
 * Copy to clipboard with a legacy fallback (textarea + execCommand) for
 * non-secure contexts where navigator.clipboard is unavailable. Only the
 * trailing newline remark adds to fenced blocks is stripped; indentation
 * and leading whitespace are preserved.
 */
async function copyText(text: string): Promise<void> {
  const cleaned = text.replace(/\n+$/, "");
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(cleaned);
      return;
    }
  } catch {
    /* fall through to the legacy path */
  }
  const ta = document.createElement("textarea");
  ta.value = cleaned;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* clipboard unavailable */
  }
  document.body.removeChild(ta);
}

/**
 * Mounted once in the root layout. Runs on mount and again on every route
 * change (App Router keeps layout components mounted across navigations, so
 * newly rendered pages need a re-scan), plus a MutationObserver catches any
 * content injected after the fact.
 */
export default function CodeBlockEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    enhance();

    const observer = new MutationObserver((mutations) => {
      const touched = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (n) => n instanceof Element && n.querySelector("pre code") !== null
        )
      );
      if (touched) enhance();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
