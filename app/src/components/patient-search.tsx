"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  lookupPatientAction,
  redeemHandoffAction,
  createAccessRequestAction,
  type LookupResult,
} from "@/server/actions/discovery-actions";
import { Field, Input, Select, Textarea, FormErrorSummary } from "./ui";
import { SubmitButton } from "./interactive";
import { CONSENT_SCOPES } from "./consent-scopes";

export type ScopeOption = { value: string; label: string };

/* ------------------------------------------------------------------ */
/* Find patient — ID / verified ABHA lookup (no name/phone directory) */
/* ------------------------------------------------------------------ */

export function PatientLookupForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<LookupResult | null>(null);

  return (
    <div className="space-y-4">
      <form
        action={(formData) => {
          const identifier = String(formData.get("identifier") ?? "");
          setResult(null);
          startTransition(async () => {
            setResult(await lookupPatientAction(identifier));
          });
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          name="identifier"
          required
          autoComplete="off"
          placeholder="Patient ID (ML-XXXXX-XXXXX-C) or 14-digit ABHA"
          aria-label="Patient ID or verified ABHA"
          className="num h-11 flex-1 rounded-lg border border-line-strong bg-paper-raised px-3.5 text-sm text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-pine focus:outline-none"
        />
        <SubmitButton className="h-11" pendingLabel="Looking up…">
          Look up
        </SubmitButton>
      </form>

      {pending ? (
        <p className="text-[13px] text-ink-soft" role="status">
          Checking the identifier…
        </p>
      ) : null}

      {result ? <LookupOutcome result={result} /> : null}
    </div>
  );
}

function LookupOutcome({ result }: { result: LookupResult }) {
  switch (result.status) {
    case "invalid":
    case "rate_limited":
    case "no_record":
      // Uniform rendering: never hints whether an arbitrary ID exists.
      return (
        <p role="alert" className="rounded-lg border border-line bg-paper-raised px-4 py-3 text-[13px] text-ink-soft">
          {result.message}
        </p>
      );
    case "request_access":
      return (
        <div className="space-y-3 rounded-lg border border-line bg-paper-raised px-4 py-4">
          <p className="text-[13px] text-ink-soft">
            A MediLink record may exist for this identifier. Send an access request — the
            patient decides exactly what to share. No name or medical data is shown before
            they approve.
          </p>
          <AccessRequestForm patientId={result.patientId} />
        </div>
      );
    case "authorized":
      return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pine/30 bg-pine-tint px-4 py-3">
          <p className="text-[13px] font-medium text-pine-ink">
            You have an active authorization for this patient.
          </p>
          <Link
            href={result.redirect}
            className="rounded-lg border border-pine bg-pine px-3 py-1.5 text-xs font-medium text-on-pine transition-colors hover:bg-pine-deep"
          >
            Open patient record →
          </Link>
        </div>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Patient-present handoff ("Patient is with me")                      */
/* ------------------------------------------------------------------ */

export function HandoffRedeemForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);

  if (patientId) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] font-medium text-pine" role="status">
          Sharing code accepted. Send an access request so the patient can approve you now,
          in person.
        </p>
        <AccessRequestForm patientId={patientId} />
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        const code = String(formData.get("code") ?? "");
        setError(null);
        startTransition(async () => {
          const res = await redeemHandoffAction(code);
          if (res.ok) setPatientId(res.patientId);
          else setError(res.message);
        });
      }}
      className="space-y-2"
    >
      <div className="flex gap-2">
        <input
          type="text"
          name="code"
          required
          autoComplete="off"
          placeholder="Sharing code, e.g. 4F2A-9B7C-1D3E"
          aria-label="Patient sharing code"
          className="num h-11 flex-1 rounded-lg border border-line-strong bg-paper-raised px-3.5 text-sm text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-pine focus:outline-none"
        />
        <SubmitButton variant="secondary" className="h-11" pendingLabel="Redeeming…">
          Patient is with me
        </SubmitButton>
      </div>
      <p className="text-xs text-ink-faint">
        The patient taps “Share with a clinician now” in their app and reads you a
        single-use code. It expires in 10 minutes.
      </p>
      {pending ? (
        <p className="text-[13px] text-ink-soft" role="status">
          Checking the code…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Access request creation (BuildPlan §7.9 / §8.3)                    */
/* ------------------------------------------------------------------ */

const PURPOSES = [
  { value: "treatment", label: "Treatment" },
  { value: "consultation", label: "Consultation" },
  { value: "record_review", label: "Record review" },
];

/** Shared catalog — see consent-scopes.ts. */
const SUGGESTABLE_SCOPES: ScopeOption[] = CONSENT_SCOPES;

export function AccessRequestForm({
  patientId,
  doctorName,
  scopes = SUGGESTABLE_SCOPES,
}: {
  patientId: string;
  doctorName?: string;
  scopes?: ScopeOption[];
}) {
  const [state, action] = useActionState(createAccessRequestAction, {});

  if (state.ok) {
    return (
      <p role="status" className="rounded-lg border border-pine/30 bg-pine-tint px-4 py-3 text-[13px] font-medium text-pine-ink">
        {state.ok}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="patientId" value={patientId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Purpose" htmlFor="ar-purpose">
          <Select id="ar-purpose" name="purpose" defaultValue="treatment">
            {PURPOSES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Visit reference" htmlFor="ar-visit" hint="e.g. OPD 24 Aug 2026, token 42">
          <Input id="ar-visit" name="visitReference" placeholder="Optional" />
        </Field>
      </div>
      <Field label="Purpose detail" htmlFor="ar-detail" hint="Plain language the patient will read before deciding.">
        <Textarea
          id="ar-detail"
          name="purposeDetail"
          rows={2}
          placeholder="e.g. Reviewing history before today's cardiac consult"
        />
      </Field>
      <Field label="Duration (days)" htmlFor="ar-days" hint="1–90 days. The patient may shorten it.">
        <Input
          id="ar-days"
          name="days"
          type="number"
          min={1}
          max={90}
          defaultValue={7}
          required
        />
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink">
          Suggested categories
        </legend>
        <p className="mt-0.5 text-xs text-ink-faint">
          Requested by {doctorName ?? "you"} — the patient chooses what to approve. Nothing is
          pre-selected on their side.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {scopes.map((s) => (
            <label
              key={s.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper-raised px-3 py-2 text-[13px] text-ink"
            >
              <input type="checkbox" name="suggestedScopes" value={s.value} className="accent-pine" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <FormErrorSummary errors={[state.error]} />
      <SubmitButton pendingLabel="Sending…">Send access request</SubmitButton>
    </form>
  );
}
