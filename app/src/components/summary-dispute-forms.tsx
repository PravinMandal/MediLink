"use client";

import { useActionState, useState } from "react";
import {
  generateSummaryAction,
  resolveDisputeAction,
} from "@/server/actions/doctor-actions";
import { Field, Input, Textarea, Badge, FormErrorSummary } from "./ui";
import { SubmitButton } from "./interactive";

/* ------------------------------------------------------------------ */



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
