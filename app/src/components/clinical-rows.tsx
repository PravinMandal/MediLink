"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronDown, PenLine } from "lucide-react";
import { cn, formatDate, TRUST_LABEL } from "@/lib/utils";
import { Badge } from "./ui";
import { SubmitButton } from "./interactive";
import { RangeBar } from "./range-bar";
import {
  EvidenceChip,
  ProvenanceDrawer,
  type ProvenanceData,
} from "./evidence-chip";
import { correctRecordAction } from "@/server/actions/doctor-actions";

/** One clinical row as rendered by the patient timeline / doctor workspace. */
export type ClinicalItem = {
  id: string;
  /** timeline kind: condition | allergy | medication | observation | … */
  kind: string;
  /** resourceType for disputes/versions: condition | allergy | medication_statement | observation … */
  resourceType: string;
  label: string;
  date: string | null;
  detail?: string | null;
  trust: string;
  /** Observation extras (RangeBar §7.7). */
  value?: string | null;
  valueString?: string | null;
  unit?: string | null;
  referenceRangeLow?: string | null;
  referenceRangeHigh?: string | null;
  flag?: string | null;
  /** True when this row is a superseded original (§7.10). */
  superseded?: boolean;
  /** Original fields, used to prefill the doctor's correction form. */
  payload?: Record<string, unknown>;
  provenance?: ProvenanceData | null;
};

const KIND_TONE: Record<string, "pine" | "amber" | "alert" | "info" | "neutral"> = {
  condition: "info",
  allergy: "alert",
  medication: "neutral",
  observation: "pine",
  procedure: "info",
  immunization: "neutral",
  report: "neutral",
  document: "neutral",
  encounter: "neutral",
};

function chipState(item: ClinicalItem): Parameters<typeof EvidenceChip>[0]["state"] {
  const p = item.provenance;
  if (p?.disputed) return "disputed";
  if (item.superseded) return "superseded";
  const lifecycle = p?.version?.lifecycleStatus ?? p?.lifecycleText;
  if (lifecycle === "corrected") return "corrected";
  if (lifecycle === "entered_in_error") return "entered_in_error";
  if (
    p?.reviewText?.startsWith("Machine-extracted") ||
    item.trust === "extracted"
  )
    return "needs_review";
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Correct-record form (§7.10)                                         */
/* ------------------------------------------------------------------ */

function CorrectRecordForm({
  item,
  patientId,
  onDone,
}: {
  item: ClinicalItem;
  patientId: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(correctRecordAction, {});
  const closedRef = useRef(false);
  // Close only on success — validation errors stay visible in the form.
  // (Ref, not state, so this is not setState-in-effect per the lint rule.)
  useEffect(() => {
    if (state?.ok && !closedRef.current) {
      closedRef.current = true;
      onDone();
    }
  }, [state, onDone]);
  const p = item.payload ?? {};
  const field =
    "h-9 w-full rounded-lg border border-line-strong bg-paper-raised px-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none";

  return (
    <form
      action={action}
      className="mt-2 space-y-2.5 rounded-lg border border-line bg-paper-sunk p-3"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="originalId" value={item.id} />
      <input type="hidden" name="originalType" value={item.resourceType} />
      <p className="text-[12px] font-medium text-ink">
        Correct: {item.label} — the original is preserved and marked superseded.
      </p>
      {item.resourceType === "condition" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[12px] text-ink-soft">
            Condition
            <input name="name" defaultValue={String(p.name ?? "")} required className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Status
            <select name="status" defaultValue={String(p.status ?? "active")} className={cn(field, "mt-1")}>
              <option value="active">active</option>
              <option value="chronic">chronic</option>
              <option value="resolved">resolved</option>
            </select>
          </label>
          <label className="block text-[12px] text-ink-soft">
            Onset date
            <input name="onsetDate" type="date" defaultValue={String(p.onsetDate ?? "")} className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Notes
            <input name="notes" defaultValue={String(p.notes ?? "")} className={cn(field, "mt-1")} />
          </label>
        </div>
      ) : item.resourceType === "allergy" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[12px] text-ink-soft">
            Substance
            <input name="substance" defaultValue={String(p.substance ?? "")} required className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Criticality
            <input name="criticality" defaultValue={String(p.criticality ?? "")} placeholder="high / medium / low" className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Reaction
            <input name="reaction" defaultValue={String(p.reaction ?? "")} className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Onset date
            <input name="onsetDate" type="date" defaultValue={String(p.onsetDate ?? "")} className={cn(field, "mt-1")} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[12px] text-ink-soft">
            Medication
            <input name="medication" defaultValue={String(p.medication ?? "")} required className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Dose
            <input name="dose" defaultValue={String(p.dose ?? "")} className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Frequency
            <input name="frequency" defaultValue={String(p.frequency ?? "")} className={cn(field, "mt-1")} />
          </label>
          <label className="block text-[12px] text-ink-soft">
            Start date
            <input name="startDate" type="date" defaultValue={String(p.startDate ?? "")} className={cn(field, "mt-1")} />
          </label>
        </div>
      )}
      <label className="block text-[12px] text-ink-soft">
        Reason for correction (required, kept with the version history)
        <textarea
          name="reason"
          required
          minLength={10}
          rows={2}
          placeholder="e.g. Transcription error in the original entry — substance corrected per the patient's history."
          className="mt-1 w-full rounded-lg border border-line-strong bg-paper-raised px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-[12.5px] font-medium text-alert">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-[12.5px] font-medium text-pine">{state.ok}</p>
      ) : null}
      <div className="flex gap-2">
        <SubmitButton>Save correction</SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="cursor-pointer rounded-lg border border-line-strong bg-paper-raised px-3 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-faint"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Row list                                                            */
/* ------------------------------------------------------------------ */

const CORRECTABLE = new Set(["condition", "allergy", "medication_statement"]);

/**
 * Clinical rows with EvidenceChip → ProvenanceDrawer, RangeBar for
 * observations (§7.7), superseded banners (§7.10), optional patient
 * dispute flow, and optional doctor "Correct record" affordance.
 */
export function ClinicalList({
  items,
  allowDispute = false,
  allowCorrect = false,
  patientId,
}: {
  items: ClinicalItem[];
  allowDispute?: boolean;
  allowCorrect?: boolean;
  patientId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [correctId, setCorrectId] = useState<string | null>(null);
  const open = items.find((i) => i.id === openId) ?? null;

  const drawerData: ProvenanceData | null = open
    ? open.provenance ?? {
        resourceId: open.id,
        resourceType: open.resourceType,
        label: open.label,
        sourceLine: null,
        sourceDocumentId: null,
        authorName: null,
        organizationName: null,
        reviewText:
          open.trust === "extracted"
            ? "Machine-extracted from the original report; not yet reviewed by a lab professional"
            : open.trust === "self_reported"
              ? "Patient-reported — not clinically reviewed"
              : "Entered directly by a contributor",
        lifecycleText: open.superseded ? "Superseded — a linked correction replaced this record" : null,
        hashFragment: null,
        version: null,
        history: [],
        disputed: false,
      }
    : null;

  return (
    <>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li
            key={`${item.kind}-${item.id}`}
            className={cn(
              "px-4 py-3 sm:px-5",
              item.superseded && "bg-paper-sunk",
            )}
          >
            {item.superseded ? (
              <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                <PenLine size={11} aria-hidden />
                Superseded — corrected on {formatDate(item.date, "short")}
              </p>
            ) : null}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p
                className={cn(
                  "text-[13.5px]",
                  item.kind === "allergy" && !item.superseded ? "font-medium text-alert" : "text-ink",
                )}
              >
                {item.label}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.superseded ? "neutral" : KIND_TONE[item.kind] ?? "neutral"}>
                  {item.kind}
                </Badge>
                <EvidenceChip
                  state={chipState(item)}
                  onOpen={() => setOpenId(item.id === openId ? null : item.id)}
                />
                {allowCorrect &&
                !item.superseded &&
                CORRECTABLE.has(item.resourceType) ? (
                  <button
                    type="button"
                    onClick={() => setCorrectId(item.id === correctId ? null : item.id)}
                    aria-expanded={correctId === item.id}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-line-strong bg-paper-raised px-2 py-0.5 text-[11px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
                  >
                    <PenLine size={11} aria-hidden /> Correct record
                    <ChevronDown
                      size={11}
                      aria-hidden
                      className={cn("transition-transform", correctId === item.id && "rotate-180")}
                    />
                  </button>
                ) : null}
                <span className="num text-[11px] text-ink-faint">
                  {formatDate(item.date, "short")}
                </span>
              </div>
            </div>
            {item.detail ? (
              <p className="mt-0.5 text-[11.5px] text-ink-faint">{item.detail}</p>
            ) : null}
            {item.trust !== "verified" && !item.superseded ? (
              <p className="mt-0.5 text-[11px] text-ink-faint">
                {TRUST_LABEL[item.trust] ?? item.trust}
              </p>
            ) : null}
            {item.kind === "observation" ? (
              <div className="mt-2">
                <RangeBar
                  value={item.value ?? item.valueString}
                  low={item.referenceRangeLow}
                  high={item.referenceRangeHigh}
                  unit={item.unit}
                  flag={item.flag}
                  name={String(item.payload?.name ?? "")}
                  date={item.date}
                  className="max-w-md"
                />
              </div>
            ) : null}
            {allowCorrect && correctId === item.id && patientId ? (
              <CorrectRecordForm
                item={item}
                patientId={patientId}
                onDone={() => setCorrectId(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <ProvenanceDrawer
        data={drawerData}
        open={openId !== null}
        onClose={() => setOpenId(null)}
        allowDispute={allowDispute}
        patientId={patientId}
      />
    </>
  );
}
