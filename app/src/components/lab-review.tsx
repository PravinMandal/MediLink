"use client";

import { useActionState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Alert } from "@/components/ui";
import { SubmitButton } from "@/components/interactive";
import {
  attestDocumentAction,
  markUnableToVerifyAction,
  type ReviewCandidate,
} from "@/server/actions/lab-actions";
import type { FormState } from "@/server/actions/auth-actions";

/* ------------------------------------------------------------------ */
/* Queue list (org page top section, §6.3 "Work queue")               */
/* ------------------------------------------------------------------ */

export function VerificationQueue({
  items,
}: {
  items: Array<{
    documentId: string;
    patientName: string;
    title: string;
    recordedDate: string | null;
    fieldCount: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader
        eyebrow="Work queue"
        title={`Verification queue (${items.length})`}
        action={
          items.length ? <Badge tone="amber">Needs review · {items.length}</Badge> : undefined
        }
      />
      <ul className="divide-y divide-line">
        {items.map((d) => (
          <li key={d.documentId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {d.patientName} — {d.title}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                {d.recordedDate ? formatDate(d.recordedDate, "short") : "no clinical date"} ·{" "}
                <span className="num">{d.fieldCount}</span> extracted field
                {d.fieldCount === 1 ? "" : "s"} awaiting review
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              {/* §7.3: amber + text, never color alone */}
              <Badge tone="amber">Needs review</Badge>
              <Link
                href={`/portal/org/review/${d.documentId}`}
                className="rounded-lg border border-line-strong bg-paper-raised px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink-faint"
              >
                Review →
              </Link>
            </div>
          </li>
        ))}
        {!items.length ? (
          <li className="px-5 py-4 text-sm text-ink-faint">
            No extracted lab reports awaiting verification. New uploads appear here once
            extraction finishes.
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Candidate fields table (§7.11 right pane)                          */
/* ------------------------------------------------------------------ */

function ReviewStateLabel({ state }: { state: string }) {
  if (state === "attested")
    return (
      <span className="text-[11px] font-medium text-info">Attested</span>
    );
  if (state === "human_reviewed")
    return (
      <span className="text-[11px] font-medium text-info">Human reviewed</span>
    );
  return (
    <Badge tone="amber">Needs review</Badge>
  );
}

function flagLabel(flag: string) {
  if (flag === "high") return "High";
  if (flag === "low") return "Low";
  if (flag === "critical") return "Critical";
  if (flag === "normal") return "Normal";
  return "No flag";
}

export function CandidateFieldsTable({ candidates }: { candidates: ReviewCandidate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <th scope="col" className="px-4 py-2 font-medium sm:px-5">Field</th>
            <th scope="col" className="px-3 py-2 font-medium">Value</th>
            <th scope="col" className="px-3 py-2 font-medium">Source range</th>
            <th scope="col" className="px-3 py-2 font-medium">Flag</th>
            <th scope="col" className="px-4 py-2 font-medium sm:px-5">Review state</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {candidates.map((c) => {
            const flagTone =
              c.flag === "critical" || c.flag === "high" || c.flag === "low"
                ? "amber"
                : "neutral";
            return (
              <tr key={c.id}>
                <td className="px-4 py-2.5 sm:px-5">
                  <p className="font-medium text-ink">{c.name}</p>
                  {c.panel ? <p className="text-[11px] text-ink-faint">{c.panel}</p> : null}
                </td>
                <td className="num px-3 py-2.5 text-ink">
                  {c.value ?? c.valueString ?? "—"}
                  {c.unit ? ` ${c.unit}` : ""}
                </td>
                <td className="num px-3 py-2.5 text-ink-soft">
                  {c.referenceRangeLow != null || c.referenceRangeHigh != null
                    ? `${c.referenceRangeLow ?? "—"} – ${c.referenceRangeHigh ?? "—"}`
                    : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={flagTone}>{flagLabel(c.flag)}</Badge>
                </td>
                <td className="px-4 py-2.5 sm:px-5">
                  <ReviewStateLabel state={c.reviewState} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attestation footer (§7.11 sticky footer equivalent)                */
/* ------------------------------------------------------------------ */

export function AttestationForms({ documentId }: { documentId: string }) {
  const [attestState, attestAction] = useActionState<FormState, FormData>(
    attestDocumentAction,
    {},
  );
  const [unableState, unableAction] = useActionState<FormState, FormData>(
    markUnableToVerifyAction,
    {},
  );

  const done = Boolean(attestState.ok) || Boolean(unableState.ok);

  if (done) {
    return (
      <div className="space-y-3">
        <Alert tone="pine" title="Decision recorded">
          {attestState.ok ?? unableState.ok}
        </Alert>
        <Link
          href="/portal/org"
          className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-paper-raised px-4 text-sm font-medium text-ink transition-colors hover:border-ink-faint"
        >
          ← Back to the work queue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={attestAction} className="space-y-3">
        <input type="hidden" name="documentId" value={documentId} />
        <label className="flex items-start gap-2.5 text-[13px] text-ink">
          <input
            type="checkbox"
            name="confirm"
            required
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-pine"
          />
          <span>
            I have compared each value against the original report. I confirm these
            extracted fields accurately represent the source.
          </span>
        </label>
        {attestState.error ? (
          <p role="alert" className="text-[12.5px] font-medium text-alert">
            {attestState.error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Attesting…">Attest and deliver</SubmitButton>
          <p className="text-[11.5px] text-ink-faint">
            Viewing never marks a field reviewed — only this explicit attestation does.
          </p>
        </div>
      </form>

      <form action={unableAction} className="border-t border-line pt-4">
        <input type="hidden" name="documentId" value={documentId} />
        {unableState.error ? (
          <p role="alert" className="mb-2 text-[12.5px] font-medium text-alert">
            {unableState.error}
          </p>
        ) : null}
        <SubmitButton variant="secondary" pendingLabel="Marking…">
          Mark unable to verify
        </SubmitButton>
        <p className="mt-1.5 text-[11.5px] text-ink-faint">
          Delivers the original document as-is (source available, structured data
          unavailable). Use when the source quality is too poor to verify extracted
          fields.
        </p>
      </form>
    </div>
  );
}
