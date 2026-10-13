"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { Reveal } from "./reveal";
import "./landing.css";

const BEATS: Array<{ step: string; title: string; body: string }> = [
  {
    step: "01",
    title: "A report arrives",
    body: "A verified lab uploads the original panel — byte-for-byte, as the instrument printed it.",
  },
  {
    step: "02",
    title: "It is sealed",
    body: "The file is hashed with sha-256. Any future edit — one byte — breaks the seal. The original stays unchanged.",
  },
  {
    step: "03",
    title: "It passes the gate",
    body: "A record moves only inside a patient-granted consent scope: cardiology, for a stated purpose, with a fixed expiry.",
  },
  {
    step: "04",
    title: "It becomes a citation",
    body: "When the AI summarizes, each sentence resolves to this sealed record. A claim without a source is dropped.",
  },
];

/**
 * Chain section — scroll-driven. The left rail's progress bar fills as the
 * beats enter the viewport; beats highlight one at a time on desktop.
 */
export function ChainSection() {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-beat]"));
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.beat);
            setActive(idx);
          }
        }
      },
      { rootMargin: "-38% 0px -38% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section aria-label="How a record travels" className="relative overflow-hidden py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
        <div>
          <Reveal>
            <p className="eyebrow mb-3">The chain</p>
            <h2 className="font-display text-[clamp(1.9rem,4vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.02em] text-ink">
              One lab report, followed through the chain.
            </h2>
          </Reveal>
          <ol ref={listRef} className="relative mt-10">
            {/* Progress rail */}
            <span aria-hidden className="absolute bottom-4 left-[22px] top-4 w-px bg-line" />
            <span
              aria-hidden
              className="chain-progress absolute left-[22px] top-4 w-px bg-gradient-to-b from-pine to-pine-deep"
              style={{
                height: "calc(100% - 2rem)",
                transform: `scaleY(${(active + 1) / BEATS.length})`,
              }}
            />
            {BEATS.map((b, i) => (
              <li
                key={b.step}
                data-beat={i}
                className="relative flex gap-5 pb-9 last:pb-0"
              >
                <span
                  aria-hidden
                  className={`num flex h-11 w-11 shrink-0 items-center justify-center rounded-full border font-display text-[15px] font-bold transition-all duration-300 ${
                    i <= active
                      ? "border-pine/40 bg-pine-tint text-pine-ink shadow-[0_0_20px_-4px_var(--action-primary)]"
                      : "border-line bg-paper-raised text-ink-faint"
                  }`}
                >
                  {b.step}
                </span>
                <div className="pt-1">
                  <h3 className="text-[16px] font-semibold tracking-tight text-ink">{b.title}</h3>
                  <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-soft">{b.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Sealed document mock — sticky on desktop */}
        <Reveal delay={140} className="lg:sticky lg:top-24">
          <div className="floaty-slow frost-strong mx-auto max-w-[400px] rounded-3xl border border-line p-6 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow text-[10px]">Renal function panel</p>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-pine-tint px-2.5 py-1 text-[10.5px] font-bold text-pine-ink">
                <FileCheck2 size={11} aria-hidden /> Sealed
              </span>
            </div>
            <p className="mt-1 text-[12px] text-ink-faint">Sunrise Diagnostics · 8 Aug 2026 · page 1 of 2</p>
            <dl className="mt-4 space-y-2.5 border-t border-line pt-4">
              {[
                ["Sodium", "140 mmol/L", false],
                ["Potassium", "4.1 mmol/L", false],
                ["Creatinine", "2.0 mg/dL", true],
                ["eGFR", "44 mL/min", true],
                ["Urea", "58 mg/dL", true],
              ].map(([k, v, hi]) => (
                <div key={k as string} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className={`num font-semibold ${hi ? "text-alert" : "text-ink"}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-xl bg-paper-sunk/70 p-3.5">
              <p className="num break-all text-[11px] font-medium leading-relaxed text-ink-faint">
                sha-256&nbsp;&nbsp;9f2c…e41a
                <br />
                attested by Dr. Meera Nair · MMC/2010/45231
                <br />
                cited by 3 summary claims
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
