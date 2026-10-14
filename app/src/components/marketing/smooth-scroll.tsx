"use client";

import { useEffect } from "react";

/**
 * Smooth scroll — Lenis on a shared GSAP ticker (single RAF for the
 * whole page). Desktop smoothing only; touch gets native scroll to
 * avoid the Lenis+GSAP+R3F triple-RAF jank reported on mobile.
 * Respects prefers-reduced-motion: no smoothing at all.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const [{ default: Lenis }, { gsap }] = await Promise.all([
        import("lenis"),
        import("gsap"),
      ]);
      const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    })();
    return () => cleanup?.();
  }, []);
  return null;
}
