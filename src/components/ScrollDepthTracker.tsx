"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-depth + time-on-post analytics tracker (client component).
 *
 * Renders nothing; reports engagement to the self-hosted Umami instance
 * that is already loaded globally (script in app/layout.tsx, website id
 * wired via NEXT_PUBLIC_UMAMI_URL). Sends:
 *
 *   scroll-25 / scroll-50 / scroll-75 / scroll-100 — each once per pageview,
 *     when the reader scrolls past that % of the page.
 *   time-on-post — once per pageview, after 30s of visible, active reading.
 *
 * Safety:
 * - window.umami is always guarded — blocked/absent analytics never crashes
 *   the page or throws.
 * - Both the modern `umami.track(name, data)` and the older
 *   `umami.trackEvent(name, data)` APIs are supported.
 * - Passive listeners + requestAnimationFrame throttle keep it off the
 *   main thread's critical path.
 */

// Minimal ambient typing for the tracker injected by layout.tsx's script.
// We only touch the surface we call, and only through optional chaining.
declare global {
  interface Window {
    umami?: {
      track?: (event: string, data?: Record<string, unknown>) => void;
      trackEvent?: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;
const TIME_ON_POST_MS = 30_000; // 30s of engaged reading
const IDLE_MS = 30_000; // no scroll for 30s → reading session pauses
const TICK_MS = 1_000; // engaged-time accumulator granularity

export default function ScrollDepthTracker({ slug }: { slug: string }) {
  // Guards so each event fires at most once per pageview. Refs survive
  // Strict Mode's mount → cleanup → mount cycle (same component instance),
  // and are reset per slug so client-side navigation between posts (which
  // reuses this instance without remounting) never leaks events across slugs.
  const firedMilestonesRef = useRef<Set<number>>(new Set());
  const timeFiredRef = useRef(false);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    // Fresh guards per slug (see above).
    firedMilestonesRef.current = new Set();
    timeFiredRef.current = false;
    lastScrollRef.current = Date.now();

    let scrollRafId: number | null = null;
    let mountRafId: number | null = null;
    let tickId: number | null = null;
    let engagedMs = 0;

    const fire = (name: string, data: Record<string, unknown>) => {
      const umami = window.umami;
      if (!umami) return; // analytics blocked/absent — drop silently
      try {
        if (typeof umami.track === "function") {
          umami.track(name, data);
        } else if (typeof umami.trackEvent === "function") {
          umami.trackEvent(name, data); // older Umami API
        }
      } catch {
        // never let analytics break reading
      }
    };

    const sendMilestones = (pct: number) => {
      for (const milestone of SCROLL_MILESTONES) {
        if (pct >= milestone && !firedMilestonesRef.current.has(milestone)) {
          firedMilestonesRef.current.add(milestone);
          fire(`scroll-${milestone}`, { slug });
        }
      }
    };

    const update = () => {
      scrollRafId = null;
      const scrollable =
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        ) - window.innerHeight;
      const pct =
        scrollable > 0
          ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100))
          : 100;
      lastScrollRef.current = Date.now();
      sendMilestones(pct);
    };

    const onScroll = () => {
      if (scrollRafId === null) {
        scrollRafId = window.requestAnimationFrame(update);
      }
    };

    // Engaged-time accumulator: a tick counts only while the tab is visible
    // and the reader is active (page load counts as the first activity;
    // any scroll within IDLE_MS afterwards refreshes it). Idle pauses the
    // count without losing progress; hiding the tab resets it. Fires once
    // at 30s. (A stricter idle reset would miss readers who stop scrolling
    // to read a long section — pausing is the deliberate choice.)
    const tick = () => {
      if (document.visibilityState !== "visible") {
        engagedMs = 0;
        return;
      }
      if (Date.now() - lastScrollRef.current > IDLE_MS) {
        return; // paused — reader stepped away
      }
      engagedMs += TICK_MS;
      if (engagedMs >= TIME_ON_POST_MS && !timeFiredRef.current) {
        timeFiredRef.current = true;
        fire("time-on-post", { slug });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        engagedMs = 0; // reset timer when the tab is hidden
      }
    };

    // If the whole page fits in the viewport, no scroll event will ever
    // come, but the reader has still seen 100% of it — fire every
    // milestone once layout is settled (rAF-deferred, per Next 16
    // set-state/side-effect rules), unless the tab is hidden.
    mountRafId = window.requestAnimationFrame(() => {
      const scrollable =
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        ) - window.innerHeight;
      if (scrollable <= 0 && document.visibilityState !== "hidden") {
        sendMilestones(100);
      }
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    tickId = window.setInterval(tick, TICK_MS);

    return () => {
      if (scrollRafId !== null) window.cancelAnimationFrame(scrollRafId);
      if (mountRafId !== null) window.cancelAnimationFrame(mountRafId);
      if (tickId !== null) window.clearInterval(tickId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [slug]);

  // Invisible tracker — nothing to render.
  return null;
}
