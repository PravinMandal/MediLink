"use client";

import { useActionState, useState } from "react";
import {
  addClinicalRecordAction,
  uploadDocumentAction,
  generateSummaryAction,
  breakGlassAction,
} from "@/server/actions/doctor-actions";
import { requestAccessAction } from "@/server/actions/patient-actions";
import { submitVerificationAction } from "@/server/actions/doctor-actions";
import { Field, Input, Select, Textarea, Badge } from "./ui";
import { SubmitButton } from "./interactive";

function StateLine({ state }: { state: { error?: string; ok?: string } }) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-[13px] font-medium text-alert">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export function VerificationForm() {
  const [state, action] = useActionState(submitVerificationAction, {});
  return (
    <form action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <Field label="Full name as registered" htmlFor="v-name">
        <Input id="v-name" name="fullName" required placeholder="Dr. Meera Iyer" />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Council registration number" htmlFor="v-reg" hint="e.g. MMC/2010/45231">
          <Input id="v-reg" name="registrationNumber" required placeholder="MMC/YYYY/NNNNN" />
        </Field>
        <Field label="State medical council" htmlFor="v-council">
          <Input id="v-council" name="council" placeholder="Maharashtra Medical Council" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Qualification" htmlFor="v-qual">
          <Input id="v-qual" name="qualification" placeholder="MBBS, MD (Internal Medicine)" />
        </Field>
        <Field label="Specialty" htmlFor="v-spec">
          <Input id="v-spec" name="specialty" placeholder="Cardiology" />
        </Field>
      </div>
      <StateLine state={state} />
      <SubmitButton pendingLabel="Submitting…">Submit for verification</SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Request access (patient hasn't granted consent)                     */
/* ------------------------------------------------------------------ */

export function RequestAccessForm({ patientId }: { patientId: string }) {
  const [state, action] = useActionState(requestAccessAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <p className="text-[13px] text-ink-soft">
        You don&apos;t have this patient&apos;s consent yet. Ask for it — the patient receives
        your request and grants from their portal.
      </p>
      <StateLine state={state} />
      <SubmitButton variant="secondary" pendingLabel="Sending…">
        Request access
      </SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Break-glass                                                         */
/* ------------------------------------------------------------------ */

export function BreakGlassForm({ patientId }: { patientId: string }) {
  const [state, action] = useActionState(breakGlassAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded-lg border border-alert/40 bg-alert-tint px-4 py-3 text-left transition-colors hover:border-alert"
      >
        <p className="text-sm font-semibold text-alert">Emergency — break-glass access</p>
        <p className="mt-0.5 text-xs text-alert/80">
          For genuine emergencies only. Requires a clinical reason; 60-minute window; patient
          notified; permanently audited.
        </p>
      </button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-alert bg-alert-tint px-4 py-4"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <p className="text-sm font-semibold text-alert">
        State the clinical reason for emergency access
      </p>
      <Textarea
        name="reason"
        required
        minLength={10}
        rows={3}
        placeholder="e.g. Unconscious patient after RTA; need allergies and anticoagulants before surgery"
        className="border-alert/40"
        aria-label="Clinical reason for emergency access"
      />
      <StateLine state={state} />
      <div className="flex gap-2">
        <SubmitButton variant="danger" pendingLabel="Breaking glass…">
          Confirm break-glass
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded-md px-3 text-[13px] font-medium text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Add clinical record                                                 */
/* ------------------------------------------------------------------ */

const RECORD_KINDS = [
  { value: "condition", label: "Condition" },
  { value: "allergy", label: "Allergy" },
  { value: "medication", label: "Medication" },
  { value: "observation", label: "Lab / observation" },
  { value: "procedure", label: "Procedure" },
];

export function AddRecordForm({ patientId }: { patientId: string }) {
  const [state, action] = useActionState(addClinicalRecordAction, {});
  const [kind, setKind] = useState("condition");

  return (
    <form action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="kind" value={kind} />
      <div role="tablist" aria-label="Record type" className="flex flex-wrap gap-1.5">
        {RECORD_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="tab"
            aria-selected={kind === k.value}
            onClick={() => setKind(k.value)}
            className={
              "cursor-pointer rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition-colors " +
              (kind === k.value
                ? "border-pine bg-pine-tint text-pine-ink"
                : "border-line bg-paper-raised text-ink-soft hover:border-line-strong")
            }
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === "condition" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Condition" htmlFor="r-name">
            <Input id="r-name" name="name" required placeholder="e.g. Type 2 diabetes mellitus" />
          </Field>
          <Field label="Status" htmlFor="r-status">
            <Select id="r-status" name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="chronic">Chronic</option>
              <option value="resolved">Resolved</option>
            </Select>
          </Field>
          <Field label="Onset date" htmlFor="r-onset">
            <Input id="r-onset" name="onsetDate" type="date" />
          </Field>
          <Field label="Notes" htmlFor="r-notes">
            <Input id="r-notes" name="notes" placeholder="Context (optional)" />
          </Field>
        </div>
      ) : null}

      {kind === "allergy" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Substance" htmlFor="r-sub">
            <Input id="r-sub" name="substance" required placeholder="e.g. Penicillin" />
          </Field>
          <Field label="Criticality" htmlFor="r-crit">
            <Select id="r-crit" name="criticality" defaultValue="">
              <option value="">—</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <Field label="Reaction" htmlFor="r-react">
            <Input id="r-react" name="reaction" placeholder="e.g. Anaphylaxis" />
          </Field>
        </div>
      ) : null}

      {kind === "medication" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Medication" htmlFor="r-med">
            <Input id="r-med" name="medication" required placeholder="e.g. Metformin" />
          </Field>
          <Field label="Dose" htmlFor="r-dose">
            <Input id="r-dose" name="dose" placeholder="e.g. 500 mg" />
          </Field>
          <Field label="Frequency" htmlFor="r-freq">
            <Input id="r-freq" name="frequency" placeholder="e.g. BD" />
          </Field>
          <Field label="Start date" htmlFor="r-start">
            <Input id="r-start" name="startDate" type="date" />
          </Field>
        </div>
      ) : null}

      {kind === "observation" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Test name" htmlFor="r-obs">
            <Input id="r-obs" name="name" required placeholder="e.g. Serum Creatinine" />
          </Field>
          <Field label="Value" htmlFor="r-val">
            <Input id="r-val" name="value" inputMode="decimal" placeholder="e.g. 1.4" />
          </Field>
          <Field label="Unit" htmlFor="r-unit">
            <Input id="r-unit" name="unit" placeholder="e.g. mg/dL" />
          </Field>
          <Field label="Date" htmlFor="r-date">
            <Input id="r-date" name="effectiveDate" type="date" />
          </Field>
        </div>
      ) : null}

      {kind === "procedure" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Procedure" htmlFor="r-proc">
            <Input id="r-proc" name="name" required placeholder="e.g. Coronary angiography" />
          </Field>
          <Field label="Date" htmlFor="r-pdate">
            <Input id="r-pdate" name="performedDate" type="date" />
          </Field>
          <Field label="Outcome" htmlFor="r-out">
            <Input id="r-out" name="outcome" placeholder="e.g. Uncomplicated" />
          </Field>
        </div>
      ) : null}

      <p className="text-xs text-ink-faint">
        Recorded with your provenance: name, organization, timestamp, and hash-chained audit.
      </p>
      <StateLine state={state} />
      <SubmitButton pendingLabel="Saving…">Add record</SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Upload document                                                     */
/* ------------------------------------------------------------------ */

export function UploadDocumentForm({ patientId }: { patientId: string }) {
  const [state, action] = useActionState(uploadDocumentAction, {});
  return (
    <form action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="u-title">
          <Input id="u-title" name="title" required placeholder="e.g. HbA1c — Apr 2026" />
        </Field>
        <Field label="Type" htmlFor="u-kind">
          <Select id="u-kind" name="kind" defaultValue="lab_report">
            <option value="lab_report">Lab report</option>
            <option value="prescription">Prescription</option>
            <option value="discharge_summary">Discharge summary</option>
            <option value="imaging_report">Imaging report</option>
            <option value="consultation_note">Consultation note</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Report date" htmlFor="u-date">
          <Input id="u-date" name="recordedDate" type="date" />
        </Field>
        <Field label="File (PDF, image or text · ≤ 20 MB)" htmlFor="u-file">
          <input
            id="u-file"
            name="file"
            type="file"
            required
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*,text/plain"
            className="w-full cursor-pointer rounded-md border border-line-strong bg-paper-raised px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-pine-tint file:px-2.5 file:py-1 file:text-[12px] file:font-medium file:text-pine-ink"
          />
        </Field>
      </div>
      <p className="text-xs text-ink-faint">
        The original is preserved byte-for-byte (SHA-256 hashed); lab values are extracted into
        structured, trend-able data.
      </p>
      <StateLine state={state} />
      <SubmitButton pendingLabel="Uploading & extracting…">Upload</SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* AI summary                                                          */
/* ------------------------------------------------------------------ */

export function GenerateSummaryForm({
  patientId,
  hasSummary,
}: {
  patientId: string;
  hasSummary: boolean;
}) {
  const [state, action] = useActionState(generateSummaryAction, {});
  return (
    <form action={action} className="space-y-3 px-4 py-4 sm:px-5">
      <input type="hidden" name="patientId" value={patientId} />
      <Field
        label="Focus (optional)"
        htmlFor="s-q"
        hint="e.g. “cardiac history”, “kidney function”, “diabetes control”"
      >
        <Input id="s-q" name="question" placeholder="Summarize everything · or focus on…" />
      </Field>
      <StateLine state={state} />
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Generating…">
          {hasSummary ? "Regenerate summary" : "Generate summary"}
        </SubmitButton>
        <Badge>Every claim cites its source</Badge>
      </div>
    </form>
  );
}
