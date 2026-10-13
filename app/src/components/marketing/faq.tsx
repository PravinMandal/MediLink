"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import "./landing.css";

/**
 * FAQ accordion — real buttons (keyboard + screen-reader correct),
 * single-open, animated height via the grid-rows trick.
 */
export function FaqAccordion({ items }: { items: Array<[string, string]> }) {
  const [open, setOpen] = useState<number>(0);

  return (
    <div className="mt-8 space-y-2.5">
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <Reveal key={q} delay={i * 60}>
            <div
              className={`rounded-2xl border bg-paper-raised transition-colors duration-200 ${
                isOpen ? "border-pine/35 shadow-sm" : "border-line"
              } ${isOpen ? "faq-open" : ""}`}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-button-${i}`}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left text-[14.5px] font-semibold text-ink"
                >
                  {q}
                  <span
                    aria-hidden
                    className="faq-icon flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine-tint text-lg font-light leading-none text-pine"
                  >
                    +
                  </span>
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-button-${i}`}
                className="faq-panel"
              >
                <div className="faq-inner">
                  <p className="px-5 pb-4 text-[13.5px] leading-relaxed text-ink-soft">{a}</p>
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
