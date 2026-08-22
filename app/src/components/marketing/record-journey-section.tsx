"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Record Journey — the D9 scroll-driven 3D section.
 *
 * The canvas is lazy-loaded (ssr:false, IntersectionObserver-gated) so the
 * portal bundle never sees three.js. The four factual beats live as real
 * DOM copy beneath/inside the section (SEO + a11y + reduced-motion
 * fallback); the canvas is aria-hidden and only ever illustrates them.
 */

const RecordJourneyCanvas = dynamic(
  () =>
    import("@/three/record-journey").then((m) => m.RecordJourneyCanvas),
  { ssr: false },
);

const STEPS: Array<[string, string]> = [
  [
    "A report arrives",
    "A verified lab uploads the original panel — byte-for-byte, as the instrument printed it.",
  ],
  [
    "It is sealed",
    "The file is hashed with sha-256. Any future edit — one byte — breaks the seal. The original is preserved forever.",
  ],
  [
    "It passes the gate",
    "A record moves only inside a patient-granted consent scope: cardiology, for a stated purpose, with a fixed expiry.",
  ],
  [
    "It becomes a citation",
    "When the AI summarizes, each sentence resolves to this sealed record. A claim without a source is dropped.",
  ],
];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function RecordJourneySection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const tickingRef = useRef(false);

  const [nearViewport, setNearViewport] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [caps, setCaps] = useState<{ reduced: boolean; lowDetail: boolean } | null>(
    null,
  );

  // Mount gate + capability probes, deferred a frame to satisfy the
  // set-state-in-effect rule (pure client reads, no cascading render cost).
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setCaps({
        reduced: prefersReducedMotion(),
        lowDetail: window.innerWidth < 640 || window.devicePixelRatio > 2,
      }),
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  // Visibility gates for the canvas.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    // Mount the canvas only when the section nears the viewport.
    const near = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setNearViewport(e.isIntersecting);
      },
      { rootMargin: "600px 0px" },
    );
    near.observe(el);

    // Pause the render loop when fully offscreen.
    const visible = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setOnScreen(e.isIntersecting);
      },
      { rootMargin: "120px 0px" },
    );
    visible.observe(el);

    return () => {
      near.disconnect();
      visible.disconnect();
    };
  }, []);

  const reduced = caps?.reduced ?? false;
  const lowDetail = caps?.lowDetail ?? false;

  // rAF-throttled scroll progress: 0 at section top hitting viewport
  // bottom, 1 at section bottom hitting viewport top.
  useEffect(() => {
    if (!caps || caps.reduced) return;
    const el = trackRef.current;
    if (!el) return;

    const update = () => {
      tickingRef.current = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const p = total > 0 ? -rect.top / total : rect.top < vh / 2 ? 1 : 0;
      progressRef.current = Math.min(1, Math.max(0, p));
    };
    const onScroll = () => {
      if (!tickingRef.current) {
        tickingRef.current = true;
        rafRef.current = requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [caps]);

  const showCanvas = nearViewport && !reduced;

  return (
    <section
      aria-label="The record journey"
      className="border-b border-line"
    >
      <div ref={trackRef} className="relative h-[420vh]">
        {/* Sticky stage */}
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="relative mx-auto w-full max-w-6xl flex-1 px-5 pt-10 sm:px-8">
            <p className="eyebrow">The record journey</p>
            <h2 className="mt-2 max-w-2xl font-display text-[clamp(1.7rem,3.6vw,2.4rem)] font-semibold leading-tight tracking-[-0.01em] text-ink">
              One lab report, followed through the chain.
            </h2>

            {/* Canvas layer (aria-hidden; DOM copy carries the content) */}
            <div
              aria-hidden
              className="absolute inset-x-5 top-1/2 bottom-0 sm:inset-x-8 lg:inset-x-0"
              style={{
                maskImage:
                  "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
              }}
            >
              {showCanvas && (
                <RecordJourneyCanvas
                  progress={progressRef}
                  lowDetail={lowDetail}
                  active={onScreen}
                />
              )}
            </div>
          </div>

          {/* Step copy rail — real content, legible without the canvas */}
          <div className="relative mx-auto w-full max-w-6xl px-5 pb-6 sm:px-8">
            <ol className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="min-w-0">
                  <span className="num text-[12px] font-semibold text-pine">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-1 font-display text-[15.5px] font-semibold leading-snug text-ink sm:text-[17px]">
                    {title}
                  </h3>
                  <p className="mt-1 hidden max-w-xs text-[12.5px] leading-relaxed text-ink-soft sm:block">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Full copy for SEO / screen readers / reduced-motion reading:
            visually hidden span carrying the complete step descriptions. */}
        <span className="sr-only">
          The record journey in four steps:{" "}
          {STEPS.map(([title, body], i) => `Step ${i + 1}: ${title}. ${body}`).join(" ")}
        </span>
      </div>

      {/* Reduced-motion fallback: the four steps as a static numbered list,
          using the page's existing sequence styling. */}
      {reduced && (
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="bg-paper-raised">
                <div className="flex h-full flex-col p-6">
                  <span className="num text-[13px] font-semibold text-pine">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-display text-[19px] font-semibold text-ink">
                    {title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
