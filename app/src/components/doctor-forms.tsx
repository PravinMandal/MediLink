"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { Siren } from "lucide-react";
import {
  addClinicalRecordAction,
  uploadDocumentAction,
  generateSummaryAction,
  breakGlassAction,
  resolveDisputeAction,
} from "@/server/actions/doctor-actions";
import { requestAccessAction } from "@/server/actions/patient-actions";
import { submitVerificationAction } from "@/server/actions/doctor-actions";
import { Field, Input, Select, Textarea, Badge, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";
import { useFocusTrap } from "./use-focus-trap";

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
  const formRef = useFocusFirstError(state.error);
  const fieldErrors = {
    fullName:
      state.error === "Could not submit verification. Check the fields and try again."
        ? "Enter your full registered name."
        : undefined,
    registrationNumber:
      state.error === "Could not submit verification. Check the fields and try again."
        ? "Enter your council registration number."
        : undefined,
  };
  return (
    <form ref={formRef} action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <Field label="Full name as registered" htmlFor="v-name" error={fieldErrors.fullName}>
        <Input
          id="v-name"
          name="fullName"
          required
          aria-invalid={fieldErrors.fullName ? true : undefined}
          aria-describedby={fieldErrors.fullName ? "v-name-error" : undefined}
          placeholder="Dr. Meera Iyer"
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Council registration number"
          htmlFor="v-reg"
          hint="e.g. MMC/2010/45231"
          error={fieldErrors.registrationNumber}
        >
          <Input
            id="v-reg"
            name="registrationNumber"
            required
            aria-invalid={fieldErrors.registrationNumber ? true : undefined}
            aria-describedby={fieldErrors.registrationNumber ? "v-reg-error" : undefined}
            placeholder="MMC/YYYY/NNNNN"
          />
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
      <FormErrorSummary errors={[state.error]} />
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

export function BreakGlassForm({ patientId }: { patientId?: string }) {
  const [state, action] = useActionState(breakGlassAction, {});
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reasonError =
    state.error === "A clinical reason of at least 10 characters is required."
      ? state.error
      : undefined;

  const closeDialog = useCallback(() => setOpen(false), []);
  useFocusTrap(dialogRef, open, closeDialog);

  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-alert bg-alert-tint px-4 py-4">
        <p className="text-sm font-semibold text-alert">{state.ok}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Direct accessible name: the visible text is nested 3 spans deep
        // (past the rule's static-analysis depth) and includes a decorative
        // arrow — a label keeps screen-reader output clean.
        aria-label="Start an emergency window. For genuine emergencies only — requires a clinical reason and password confirmation."
        className="glass-hover group w-full cursor-pointer rounded-xl border border-alert/50 bg-alert-tint px-4 py-4 text-left transition-all hover:border-alert hover:shadow-md"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-alert text-on-alert shadow-sm"
          >
            <Siren size={20} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold text-alert">
              Start an emergency window
            </span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              For genuine emergencies only — requires a clinical reason and
              password confirmation. 60-minute window; patient notified;
              permanently audited.
            </span>
          </span>
          <span
            aria-hidden
            className="text-alert transition-transform duration-200 group-hover:translate-x-0.5"
          >
            →
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bg-title"
      tabIndex={-1}
      className="space-y-3 rounded-lg border border-alert bg-alert-tint px-4 py-4 focus:outline-none"
    >
      <form action={action} className="space-y-3">
        <input type="hidden" name="patientId" value={patientId ?? ""} />
        <p id="bg-title" className="text-sm font-semibold text-alert">
          State the clinical reason for emergency access
        </p>
        <Field label="Patient ID or ABHA number" htmlFor="bg-patient">
          <Input
            id="bg-patient"
            name="patientIdText"
            defaultValue={patientId ?? ""}
            placeholder="ML-XXXXX-XXXXX-C or 14-digit ABHA"
            required
          />
        </Field>
        <Textarea
          name="reason"
          required
          minLength={10}
          rows={3}
          placeholder="e.g. Unconscious patient after RTA; need allergies and anticoagulants before surgery"
          className="border-alert/40"
          aria-label="Clinical reason for emergency access"
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? "bg-reason-error" : undefined}
        />
        {reasonError ? (
          <p id="bg-reason-error" className="text-xs font-medium text-alert">
            {reasonError}
          </p>
        ) : null}
        <Field
          label="Confirm your password"
          htmlFor="bg-stepup"
          hint="Emergency access requires confirming your password."
        >
          <Input
            id="bg-stepup"
            name="stepUpPassword"
            type="password"
            autoComplete="current-password"
            placeholder="Your account password"
            className="border-alert/40"
          />
        </Field>
        {state.error && !reasonError ? (
          <p role="alert" className="text-[13px] font-medium text-alert">{state.error}</p>
        ) : null}
        <div className="flex gap-2">
          <SubmitButton variant="danger" pendingLabel="Breaking glass…">
            Confirm break-glass
          </SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-lg px-3 text-[13px] font-medium text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
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
  const formRef = useFocusFirstError(state.error);

  // Server rejects missing names per kind — surface it on that field.
  const nameError =
    state.error?.endsWith("name is required.") || state.error?.endsWith("substance is required.")
      ? state.error
      : undefined;

  return (
    <form ref={formRef} action={action} className="space-y-4 px-4 py-4 sm:px-5">
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
              "cursor-pointer rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors " +
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
          <Field label="Condition" htmlFor="r-name" error={nameError}>
            <Input
              id="r-name"
              name="name"
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "r-name-error" : undefined}
              placeholder="e.g. Type 2 diabetes mellitus"
            />
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
          <Field label="Substance" htmlFor="r-sub" error={nameError}>
            <Input
              id="r-sub"
              name="substance"
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "r-sub-error" : undefined}
              placeholder="e.g. Penicillin"
            />
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
          <Field label="Medication" htmlFor="r-med" error={nameError}>
            <Input
              id="r-med"
              name="medication"
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "r-med-error" : undefined}
              placeholder="e.g. Metformin"
            />
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
          <Field label="Test name" htmlFor="r-obs" error={nameError}>
            <Input
              id="r-obs"
              name="name"
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "r-obs-error" : undefined}
              placeholder="e.g. Serum Creatinine"
            />
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
          <Field label="Procedure" htmlFor="r-proc" error={nameError}>
            <Input
              id="r-proc"
              name="name"
              required
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "r-proc-error" : undefined}
              placeholder="e.g. Coronary angiography"
            />
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
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
      <SubmitButton pendingLabel="Saving…">Add record</SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Upload document                                                     */
/* ------------------------------------------------------------------ */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const OVERSIZE_FILE_ERROR =
  "File is larger than 4 MB — compress or split the PDF.";

export function UploadDocumentForm({ patientId }: { patientId: string }) {
  const [state, action] = useActionState(uploadDocumentAction, {});
  const formRef = useFocusFirstError(state.error);
  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const fileErrorId = "u-file-oversize";
  const fieldErrors = {
    title: state.error === "Give the document a title." ? state.error : undefined,
    file:
      fileError ??
      (state.error === "Choose a file to upload." ? state.error : undefined),
  };
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement)
          ?.files?.[0];
        if (file && file.size > MAX_UPLOAD_BYTES) {
          e.preventDefault();
          setFileError(OVERSIZE_FILE_ERROR);
        }
      }}
      className="space-y-4 px-4 py-4 sm:px-5"
    >
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title" htmlFor="u-title" error={fieldErrors.title}>
          <Input
            id="u-title"
            name="title"
            required
            aria-invalid={fieldErrors.title ? true : undefined}
            aria-describedby={fieldErrors.title ? "u-title-error" : undefined}
            placeholder="e.g. HbA1c — Apr 2026"
          />
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
        <Field
          label="File (PDF, image or text · ≤ 4 MB)"
          htmlFor="u-file"
          error={fieldErrors.file}
        >
          <input
            id="u-file"
            name="file"
            type="file"
            required
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              setFileError(
                file && file.size > MAX_UPLOAD_BYTES ? OVERSIZE_FILE_ERROR : undefined,
              );
            }}
            aria-invalid={fieldErrors.file ? true : undefined}
            aria-describedby={
              [fieldErrors.file ? "u-file-error" : null, fileError ? fileErrorId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/*,text/plain"
            className="w-full cursor-pointer rounded-lg border border-line-strong bg-paper-raised px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-pine-tint file:px-2.5 file:py-1 file:text-[12px] file:font-medium file:text-pine-ink"
          />
        </Field>
      </div>
      <p className="text-xs text-ink-faint">
        The original is preserved byte-for-byte (SHA-256 hashed); lab values are extracted into
        structured, trend-able data.
      </p>
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
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
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Generating…">
          {hasSummary ? "Regenerate summary" : "Generate summary"}
        </SubmitButton>
        <Badge>Every claim cites its source</Badge>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Patient concern resolution (Backlog D — closes the dispute loop)    */
/* ------------------------------------------------------------------ */

export function ResolveDisputeForm({
  disputeId,
  patientId,
}: {
  disputeId: string;
  patientId: string;
}) {
  const [state, action] = useActionState(resolveDisputeAction, {});
  const [decision, setDecision] = useState<"confirm" | "dismiss">("confirm");
  if (state.ok) {
    return (
      <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
    );
  }
  return (
    <form action={action} className="mt-3 space-y-3 border-t border-line pt-3">
      <input type="hidden" name="disputeId" value={disputeId} />
      <input type="hidden" name="patientId" value={patientId} />
      <fieldset>
        <legend className="text-xs font-semibold text-ink">Your review</legend>
        <div className="mt-1.5 flex gap-2">
          {(["confirm", "dismiss"] as const).map((d) => (
            <label
              key={d}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                decision === d
                  ? "border-ink bg-ink text-paper"
                  : "border-line-strong text-ink-soft hover:border-ink-faint"
              }`}
            >
              <input
                type="radio"
                name="decision"
                value={d}
                checked={decision === d}
                onChange={() => setDecision(d)}
                className="sr-only"
              />
              {d === "confirm" ? "Confirm issue" : "Dismiss"}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        label={decision === "dismiss" ? "Note to patient (required)" : "Note (optional)"}
        htmlFor={`dn-${disputeId}`}
      >
        <Textarea
          id={`dn-${disputeId}`}
          name="notes"
          rows={2}
          placeholder={
            decision === "dismiss"
              ? "Why is this record correct as written?"
              : "What did you verify?"
          }
        />
      </Field>
      <StateLine state={state} />
      <SubmitButton variant="secondary" pendingLabel="Saving…">
        Record review
      </SubmitButton>
    </form>
  );
}
