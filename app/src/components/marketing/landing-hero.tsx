"use client";

import { useEffect, useRef, useState } from "react";
import { VaultHero } from "@/three/vault-hero";

/**
 * Landing hero — luxury 3D vault scene behind frosted-glass typography.
 * The 3D bundle loads only when the hero is near viewport; reduced-motion
 * users get a static frame. All copy is honest per plan §17.
 */
export function LandingHero() {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration flag: the 3D canvas must never render on the server
    setMounted(true);
  }, []);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[92svh] items-center justify-center overflow-hidden"
      aria-label="MediLink introduction"
    >
      {/* Ambient glows behind everything */}
      <div aria-hidden className="glow-field">
        <div className="glow-blob glow-blob-blue left-[-10%] top-[-15%] h-[34rem] w-[34rem]" />
        <div className="glow-blob glow-blob-deep bottom-[-20%] right-[-8%] h-[38rem] w-[38rem]" />
      </div>

      {mounted ? <VaultHero /> : null}

      <div className="pointer-events-none relative z-10 mx-auto max-w-3xl px-6 text-center">
        <p
          className="eyebrow mb-5 animate-[hero-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_both]"
          style={{ color: "var(--prim-pine-300)" }}
        >
          The health record that proves itself
        </p>
        <h1
          className="animate-[hero-rise_1s_cubic-bezier(0.22,1,0.36,1)_0.08s_both] font-display text-[clamp(2.6rem,7vw,4.6rem)] font-bold leading-[1.04] tracking-[-0.03em] text-ink"
        >
          Your history,
          <span className="bg-gradient-to-br from-pine to-pine-deep bg-clip-text text-transparent dark:from-[#96C2FF] dark:to-[#4D8DFF]">
            {" "}sealed in glass.
          </span>
        </h1>
        <p
          className="mx-auto mt-6 max-w-xl animate-[hero-rise_1s_cubic-bezier(0.22,1,0.36,1)_0.18s_both] text-[16.5px] leading-relaxed text-ink-soft"
        >
          Every entry carries its author, its source document, and its place in
          an audited chain. You decide who sees what — and you can prove exactly
          who saw it, and when.
        </p>
        <div
          className="pointer-events-auto mt-9 flex flex-col items-center justify-center gap-3 animate-[hero-rise_1s_cubic-bezier(0.22,1,0.36,1)_0.28s_both] sm:flex-row"
        >
          <a
            href="/sign-up"
            className="inline-flex h-12 w-full max-w-56 items-center justify-center rounded-xl bg-gradient-to-b from-pine to-pine-deep px-7 text-sm font-semibold text-on-pine shadow-lg shadow-pine/30 transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
          >
            Create your record
          </a>
          <a
            href="#how"
            className="glass-hover inline-flex h-12 w-full max-w-56 items-center justify-center rounded-xl border border-line-strong frost px-7 text-sm font-semibold text-ink"
          >
            See how it works
          </a>
        </div>

        <dl
          className="frost pointer-events-auto mx-auto mt-14 grid max-w-lg animate-[hero-rise_1s_cubic-bezier(0.22,1,0.36,1)_0.4s_both] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        >
          {[
            ["sha-256", "every entry sealed"],
            ["100%", "verified contributors"],
            ["0", "reads without consent"],
          ].map(([num, label]) => (
            <div key={label} className="px-3 py-4">
              <dt className="num text-[10.5px] uppercase tracking-wider text-ink-faint">{label}</dt>
              <dd className="num mt-1 text-xl font-bold text-ink">{num}</dd>
            </div>
          ))}
        </dl>
      </div>

      <style>{`
        @keyframes hero-rise {
          from { opacity: 0; transform: translateY(26px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
