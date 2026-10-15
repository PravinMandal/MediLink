"use client";

import { useActionState, useState } from "react";
import { addClinicalRecordAction } from "@/server/actions/doctor-actions";
import { Field, Input, Select, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";

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
