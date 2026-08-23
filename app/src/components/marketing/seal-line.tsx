"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seal line — the hero's signature motion moment: a sha-256-shaped digest
 * types itself out and "seals" with the verified tick. One motif, tied to
 * the thesis (every record is hash-sealed), opacity-only animation,
 * fully skipped under prefers-reduced-motion (static sealed state).
 */
const DIGEST = "9f2c a41e 77b3 0d58 c6f2 1a9b 4e30 88d1 5f0a b7c4 23e9 d617 40b8 af52 19cd 63e0";

export function SealLine() {
  const [len, setLen] = useState(0);
  const [sealing, setSealing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setLen(DIGEST.length), 0);
      return () => clearTimeout(t);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || started.current) return;
      started.current = true;
      setSealing(true);
      let i = 0;
      const step = () => {
        i += 2;
        setLen(Math.min(i, DIGEST.length));
        if (i < DIGEST.length) setTimeout(step, 28);
        else setTimeout(() => setSealing(false), 500);
      };
      setTimeout(step, 350);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const sealed = len >= DIGEST.length && !sealing;

  return (
    <div
      ref={ref}
      className="mt-6 flex items-center gap-3 border-t border-line pt-4"
      aria-hidden
    >
      <p className="num text-[11px] leading-relaxed tracking-wide text-ink-faint">
        sha-256&nbsp;
        <span className={sealed ? "text-pine" : "text-ink-soft"}>
          {DIGEST.slice(0, len)}
          {!sealed ? <span className="animate-pulse">▌</span> : ""}
        </span>
      </p>
      <span
        className={
          "seal transition-opacity duration-500 " + (sealed ? "opacity-100" : "opacity-0")
        }
      >
        ✓ sealed
      </span>
    </div>
  );
}
