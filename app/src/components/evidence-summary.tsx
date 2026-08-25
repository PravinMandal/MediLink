"use client";

import { Sparkles } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * EvidenceSummary — the AI summary surface, redesigned (§7.13).
 *
 * Design language: a vertical evidence rail. Each recorded-fact group is a
 * station on a glowing sapphire line; every claim is a frosted card whose
 * citation chips open their source. Replaces the flat tab-list layout.
 *
 * Safety copy is structural: the header states what this is and isn't, and
 * the footer repeats it — AI organises cited records; it never recommends.
 */

export type SummaryGroup = {
  key: string;
  label: string;
  claims: Array<{
    id: string;
    text: string;
    alert?: boolean;
    citationSlot?: ReactNode;
  }>;
};

export function EvidenceSummaryShell({
  children,
  meta,
  action,
}: {
  children: ReactNode;
  /** e.g. "deterministic · generated 24 Aug 2026" */
  meta: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative">
      {/* Ambient glow inside the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--prim-pine-300), transparent 70%)" }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pine to-pine-deep shadow-md shadow-pine/30"
          >
            <Sparkles size={15} className="text-on-pine" />
          </span>
          <div>
            <p className="text-[14.5px] font-semibold tracking-tight text-ink">Evidence summary</p>
            <p className="text-[11px] text-ink-faint">
              Generated from records in MediLink · verify against sources
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="px-5 pb-1 sm:px-6">{children}</div>
      <p className="border-t border-line/70 px-5 py-3 text-[11px] leading-relaxed text-ink-faint sm:px-6">
        Every statement resolves to the records it was built from — open any
        citation to see it. MediLink organises evidence; it never diagnoses,
        recommends, or fills gaps with reassurance. {meta}
      </p>
    </div>
  );
}

export function EvidenceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      className="relative ml-3 space-y-2 border-l-2 py-3 pl-5"
      style={{
        borderColor:
          "color-mix(in srgb, var(--prim-pine-300) 55%, transparent)",
      }}
    >
      {/* Station node on the evidence rail */}
      <span
        aria-hidden
        className="absolute -left-[7px] top-4 h-3 w-3 rounded-full border-2 border-paper-raised bg-gradient-to-br from-pine to-pine-deep shadow-[0_0_10px_2px_color-mix(in_srgb,var(--prim-pine-300)_45%,transparent)]"
      />
      <p className="eyebrow text-[10.5px]" style={{ color: "var(--prim-pine-300)" }}>
        {label}
      </p>
      {children}
    </section>
  );
}

export function EvidenceClaim({
  text,
  citation,
  tone,
}: {
  text: string;
  /** Rendered CitationChips (client component) */
  citation?: ReactNode;
  tone?: "alert";
}) {
  return (
    <div
      className={cn(
        "glass-hover rounded-xl border p-3",
        tone === "alert"
          ? "border-alert/30 bg-alert-tint/80"
          : "border-line/80 bg-paper-sunk/50",
      )}
    >
      <p
        className={cn(
          "text-[13.5px] leading-relaxed",
          tone === "alert" ? "font-medium text-alert" : "text-ink",
        )}
      >
        {text}
      </p>
      {citation ? <div className="mt-1.5">{citation}</div> : null}
    </div>
  );
}

/** Date chip reused by summary footers. */
export function GeneratedChip({ at }: { at: string }) {
  return (
    <span className="num rounded-md border border-line bg-paper-sunk px-1.5 py-0.5 text-[10.5px] text-ink-faint">
      {formatDate(at)}
    </span>
  );
}
