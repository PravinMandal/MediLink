"use client";

import { useState } from "react";

/**
 * The signature element: a real-shaped summary claim whose numbered citations
 * expand into their evidence chain — source document, facility, date, hash,
 * verified seal. This is the product's thesis, staged as an interaction.
 */
const CLAIMS: Array<{
  section: string;
  text: string;
  sources: Array<{ label: string; org: string; date: string; hash: string }>;
}> = [
  {
    section: "Assessment",
    text: "HbA1c rising over three years: 7.8% → 8.1% → 8.4%, latest above reference.",
    sources: [
      {
        label: "HbA1c & Fasting Glucose — Apr 2026",
        org: "Sunrise Diagnostics · verified lab",
        date: "08 Apr 2026",
        hash: "a3f9…c21e",
      },
      {
        label: "HbA1c & Fasting Glucose — Apr 2025",
        org: "Sunrise Diagnostics · verified lab",
        date: "09 Apr 2025",
        hash: "7d02…9ab4",
      },
      {
        label: "HbA1c & Fasting Glucose — Apr 2024",
        org: "Sunrise Diagnostics · verified lab",
        date: "10 Apr 2024",
        hash: "b91c…4e07",
      },
    ],
  },
  {
    section: "Situation",
    text: "ALLERGY — Penicillin (high): anaphylaxis, documented in childhood records.",
    sources: [
      {
        label: "Allergy entry — Dr. Meera Iyer, MD",
        org: "City General Hospital · verified",
        date: "18 Feb 2019",
        hash: "e57a…11bd",
      },
    ],
  },
  {
    section: "Background",
    text: "Percutaneous coronary intervention with drug-eluting stent — uncomplicated.",
    sources: [
      {
        label: "Discharge summary — PCI",
        org: "Lakeview Cardiac Institute · verified",
        date: "10 Nov 2022",
        hash: "44fe…d930",
      },
      {
        label: "Coronary angiography report",
        org: "Lakeview Cardiac Institute · verified",
        date: "28 Oct 2022",
        hash: "08cc…7f62",
      },
    ],
  },
];

export function EvidenceCard() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="w-full max-w-xl" data-testid="evidence-card">
      <div
        aria-hidden
        className="mb-3 flex items-center justify-between"
      >
        <p className="eyebrow">AI-generated summary · SBAR</p>
        <span className="seal">✓ Sources linked</span>
      </div>

      <div className="card overflow-hidden border-line-strong shadow-[0_1px_2px_rgba(27,36,32,0.06),0_16px_40px_-16px_rgba(27,36,32,0.22)]">
        <ul>
          {CLAIMS.map((claim, i) => {
            const isOpen = open === i;
            return (
              <li key={i} className={i > 0 ? "border-t border-line" : ""}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="group flex w-full cursor-pointer items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-paper-sunk/60 sm:px-5"
                >
                  <span>
                    <span className="eyebrow block">{claim.section}</span>
                    <span className="mt-1 block text-[14px] leading-relaxed text-ink">
                      {claim.text}
                    </span>
                  </span>
                  <span className="mt-4 flex shrink-0 gap-1">
                    {claim.sources.map((s, j) => (
                      <span
                        key={j}
                        className="num flex h-6 min-w-6 items-center justify-center rounded-[5px] border border-pine/50 bg-pine-tint px-1.5 text-[11px] font-semibold text-pine-ink transition-colors group-hover:border-pine group-hover:bg-pine group-hover:text-on-pine"
                      >
                        {j + 1}
                      </span>
                    ))}
                  </span>
                </button>
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    transition: "grid-template-rows 300ms cubic-bezier(0.2,0.8,0.2,1)",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <ol className="border-t border-dashed border-line-strong bg-paper-sunk/50 px-4 py-3 sm:px-5">
                      {claim.sources.map((s, j) => (
                        <li
                          key={j}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5"
                        >
                          <span className="flex items-baseline gap-2">
                            <span className="num text-[10px] text-ink-faint">
                              [{j + 1}]
                            </span>
                            <span className="text-[12.5px] font-medium text-ink">
                              {s.label}
                            </span>
                          </span>
                          <span className="text-[11px] text-ink-soft">
                            {s.org} · {s.date}{" "}
                            <span className="num text-ink-faint">sha {s.hash}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line bg-paper-raised px-4 py-2.5 text-[10.5px] text-ink-faint sm:px-5">
          Every statement resolves to records it was generated from. Click a claim to
          inspect its evidence chain.
        </p>
      </div>
    </div>
  );
}
