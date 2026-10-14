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
  stale = false,
}: {
  children: ReactNode;
  /** e.g. "deterministic · generated 24 Aug 2026" */
  meta: string;
  action?: ReactNode;
  stale?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-[0_8px_32px_-12px_rgba(0,0,0,0.25)]">
      {/* Ambient glow inside the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-0 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--prim-pine-300), transparent 70%)" }}
      />
      {/* top accent rule */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-[var(--prim-pine-300)] to-transparent opacity-70"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2E7BFF] to-[#12429E] shadow-md shadow-pine/30"
          >
            <Sparkles size={16} className="text-white" />
          </span>
          <div>
            <p className="flex items-center gap-2 text-[14.5px] font-semibold tracking-tight text-ink">
              Evidence summary
              {stale ? (
                <span className="rounded-full border border-amber/40 bg-amber-tint px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber">
                  Stale — regenerate
                </span>
              ) : (
                <span className="rounded-full border border-pine/30 bg-pine-tint px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-pine-ink">
                  Cited
                </span>
              )}
            </p>
            <p className="text-[11px] text-ink-faint">
              Generated from records in MediLink · verify against sources
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="px-5 pb-1 sm:px-6">{children}</div>
      <p className="border-t border-line/70 bg-paper-sunk/40 px-5 py-3 text-[11px] leading-relaxed text-ink-faint sm:px-6">
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
      <p className="eyebrow text-[10.5px] text-pine-ink">
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
