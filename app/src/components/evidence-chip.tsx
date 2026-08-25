"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useActionState } from "react";
import {
  Clock,
  FileText,
  Flag,
  History,
  Info,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Button, Textarea } from "./ui";
import { SubmitButton } from "./interactive";
import { raiseDisputeAction } from "@/server/actions/patient-actions";

/* ------------------------------------------------------------------ */
/* Types (mirrors ProvenanceRow from records/provenance — serialized)  */
/* ------------------------------------------------------------------ */

export type ProvenanceData = {
  resourceId: string;
  resourceType: string;
  label: string;
  sourceLine: string | null;
  sourceDocumentId: string | null;
  authorName: string | null;
  organizationName: string | null;
  reviewText: string;
  lifecycleText: string | null;
  hashFragment: string | null;
  version: {
    versionId: string;
    version: number;
    lifecycleStatus: string;
    correctionReason: string | null;
    sealedAt: string;
  } | null;
  history: Array<{
    versionId: string;
    version: number;
    lifecycleStatus: string;
    correctionReason: string | null;
    reviewState: string;
    sealedAt: string;
    replacesVersionId: string | null;
  }>;
  disputed: boolean;
};

const LIFECYCLE_LABEL: Record<string, string> = {
  active: "Active",
  corrected: "Corrected",
  superseded: "Superseded",
  entered_in_error: "Entered in error",
  disputed: "Disputed — under review",
};

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

/**
 * Accessible provenance drawer (BuildPlan §7.5): dialog semantics, focus
 * trap, Escape close, aria attributes. Shows source line, author/org,
 * review state in words, lifecycle, payload hash fragment, and linked
 * version history. Optionally offers "Flag a concern" (§7.10 patient view)
 * via disputes.raise.
 */
export function ProvenanceDrawer({
  data,
  open,
  onClose,
  allowDispute = false,
  patientId,
}: {
  data: ProvenanceData | null;
  open: boolean;
  onClose: () => void;
  allowDispute?: boolean;
  patientId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [state, action] = useActionState(raiseDisputeAction, {});

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      // Focus trap: cycle Tab within the drawer
      const focusables = ref.current.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close provenance"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/20"
        style={{ animation: "prov-fade 150ms ease-out" }}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-paper-raised shadow-xl focus:outline-none"
        style={{ animation: "prov-slide 200ms cubic-bezier(0.2,0.8,0.2,1)" }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <p className="eyebrow">Provenance</p>
            <p
              id={headingId}
              className="font-display text-[15px] font-semibold leading-tight text-ink"
            >
              {data.label}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X size={14} aria-hidden /> Close
          </Button>
        </div>

        <div className="flex-1 divide-y divide-line overflow-y-auto">
          {/* Source */}
          <section className="px-5 py-4">
            <p className="eyebrow mb-1.5">Source</p>
            {data.sourceLine ? (
              <p className="flex items-start gap-2 text-[13px] text-ink">
                <FileText size={15} className="mt-0.5 shrink-0 text-pine" aria-hidden />
                <span>
                  {data.sourceLine}
                  {data.sourceDocumentId ? (
                    <>
                      {" "}
                      <a
                        href={`/api/files/${data.sourceDocumentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-pine underline decoration-pine/40 underline-offset-2 hover:decoration-pine"
                      >
                        Open original ↗
                      </a>
                    </>
                  ) : null}
                </span>
              </p>
            ) : (
              <p className="text-[13px] text-ink-soft">
                No source document — entered directly into MediLink.
              </p>
            )}
          </section>

          {/* Author + review state */}
          <section className="px-5 py-4">
            <p className="eyebrow mb-1.5">Who recorded it &amp; review state</p>
            <p className="text-[13px] text-ink">
              {[data.authorName, data.organizationName].filter(Boolean).join(" · ") ||
                "Unknown contributor"}
            </p>
            <p className="mt-1.5 flex items-start gap-2 text-[12.5px] text-ink-soft">
              {data.reviewText.startsWith("Machine-extracted") ? (
                <Info size={14} className="mt-0.5 shrink-0 text-amber" aria-hidden />
              ) : (
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-pine" aria-hidden />
              )}
              <span>{data.reviewText}.</span>
            </p>
          </section>

          {/* Lifecycle */}
          {data.lifecycleText ? (
            <section className="px-5 py-4">
              <p className="eyebrow mb-1.5">Lifecycle</p>
              <p
                className={cn(
                  "flex items-center gap-2 text-[13px] font-medium",
                  data.disputed || data.lifecycleText.startsWith("Entered in error")
                    ? "text-alert"
                    : "text-ink",
                )}
              >
                {data.disputed ? (
                  <TriangleAlert size={14} aria-hidden />
                ) : (
                  <RotateCcw size={14} aria-hidden />
                )}
                {data.lifecycleText}
              </p>
            </section>
          ) : null}

          {/* Integrity */}
          {data.hashFragment ? (
            <section className="px-5 py-4">
              <p className="eyebrow mb-1.5">Integrity</p>
              <p className="num text-[12px] text-ink-soft">
                sha256 <span className="text-ink">{data.hashFragment}</span>…
                {data.version
                  ? ` · sealed ${formatDate(data.version.sealedAt)}`
                  : " (source document content hash)"}
              </p>
            </section>
          ) : null}

          {/* Version history */}
          {data.history.length ? (
            <section className="px-5 py-4">
              <p className="eyebrow mb-2">Version history</p>
              <ol className="space-y-2">
                {data.history.map((v) => (
                  <li
                    key={v.versionId}
                    className="flex items-start gap-2.5 rounded-lg border border-line bg-paper p-2.5"
                  >
                    <History size={14} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-ink">
                        Version {v.version} ·{" "}
                        <span
                          className={
                            v.lifecycleStatus === "active"
                              ? "text-pine"
                              : v.lifecycleStatus === "disputed"
                                ? "text-alert"
                                : "text-ink-soft"
                          }
                        >
                          {LIFECYCLE_LABEL[v.lifecycleStatus] ?? v.lifecycleStatus}
                        </span>
                      </p>
                      <p className="num mt-0.5 text-[11px] text-ink-faint">
                        sealed {formatDate(v.sealedAt, "short")}
                        {v.replacesVersionId
                          ? ` · replaces version ${v.replacesVersionId.slice(0, 8)}…`
                          : ""}
                      </p>
                      {v.correctionReason ? (
                        <p className="mt-1 text-[11.5px] text-ink-soft">
                          Reason: {v.correctionReason}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[11px] text-ink-faint">
                Corrections create linked new versions — originals are never overwritten.
              </p>
            </section>
          ) : null}

          {/* Patient dispute flow (§7.10) */}
          {allowDispute ? (
            <section className="px-5 py-4">
              <p className="eyebrow mb-1.5">Something wrong with this record?</p>
              {data.disputed ? (
                <p className="flex items-center gap-2 text-[12.5px] font-medium text-alert">
                  <TriangleAlert size={14} aria-hidden />
                  You have flagged this record — it is under review.
                </p>
              ) : disputeOpen ? (
                <form action={action} className="space-y-2.5">
                  <input type="hidden" name="patientId" value={patientId ?? ""} />
                  <input type="hidden" name="resourceId" value={data.resourceId} />
                  <input type="hidden" name="resourceType" value={data.resourceType} />
                  <label htmlFor="dispute-reason" className="block text-[13px] font-medium text-ink">
                    Describe what is wrong
                  </label>
                  <Textarea
                    id="dispute-reason"
                    name="reason"
                    required
                    minLength={5}
                    rows={3}
                    placeholder="e.g. This is not my allergy — I have never reacted to penicillin."
                  />
                  <SubmitButton>Flag for review</SubmitButton>
                  {state.error ? (
                    <p role="alert" className="text-[12.5px] font-medium text-alert">
                      {state.error}
                    </p>
                  ) : null}
                  {state.ok ? (
                    <p role="status" className="text-[12.5px] font-medium text-pine">
                      {state.ok}
                    </p>
                  ) : null}
                </form>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setDisputeOpen(true)}>
                  <Flag size={13} aria-hidden /> Flag a concern
                </Button>
              )}
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-ink-faint">
                <Clock size={12} className="mt-0.5 shrink-0" aria-hidden />
                Flagging records a dispute for review. It does not change the record or its
                attestation.
              </p>
            </section>
          ) : null}
        </div>
      </div>
      <style>{`
        @keyframes prov-slide { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes prov-fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EvidenceChip                                                        */
/* ------------------------------------------------------------------ */

/**
 * Compact chip (BuildPlan §7.5): "Evidence" or a state label ("Needs
 * review" / "Corrected" / "Disputed"). Always has an icon + text — never an
 * unexplained colored pill — and opens the provenance drawer.
 */
export function EvidenceChip({
  label = "Evidence",
  state,
  onOpen,
  className,
}: {
  label?: string;
  /** Derived state label shown instead of / alongside the default label. */
  state?: "needs_review" | "corrected" | "superseded" | "disputed" | "entered_in_error";
  onOpen: () => void;
  className?: string;
}) {
  const config = {
    needs_review: { text: "Needs review", icon: <Info size={12} aria-hidden />, cls: "border-amber/40 bg-amber-tint text-amber" },
    corrected: { text: "Corrected", icon: <RotateCcw size={12} aria-hidden />, cls: "border-line-strong bg-paper-sunk text-ink-soft" },
    superseded: { text: "Superseded", icon: <History size={12} aria-hidden />, cls: "border-line-strong bg-paper-sunk text-ink-soft" },
    disputed: { text: "Disputed", icon: <TriangleAlert size={12} aria-hidden />, cls: "border-alert/40 bg-alert-tint text-alert" },
    entered_in_error: { text: "Entered in error", icon: <TriangleAlert size={12} aria-hidden />, cls: "border-alert/40 bg-alert-tint text-alert" },
  } as const;
  const s = state ? config[state] : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        s ? s.cls : "border-pine/30 bg-pine-tint text-pine-ink hover:border-pine/60",
        className,
      )}
      aria-haspopup="dialog"
    >
      {s ? s.icon : <FileText size={12} aria-hidden />}
      {s ? `${label} · ${s.text}` : label}
    </button>
  );
}
