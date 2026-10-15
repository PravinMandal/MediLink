"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { Siren } from "lucide-react";
import { breakGlassAction } from "@/server/actions/doctor-actions";
import { Field, Input, Textarea } from "./ui";
import { SubmitButton } from "./interactive";
import { useFocusTrap } from "./use-focus-trap";

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
