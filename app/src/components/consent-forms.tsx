"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  grantConsentAction,
  revokeConsentAction,
} from "@/server/actions/patient-actions";
import { Field, Input, Select, Badge, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";

export type GranteeOption = {
  id: string;
  label: string;
  sub: string;
};

const SCOPES: Array<{ value: string; label: string; default?: boolean }> = [
  { value: "demographics", label: "Demographics & identity", default: true },
  { value: "conditions", label: "Conditions & diagnoses", default: true },
  { value: "allergies", label: "Allergies", default: true },
  { value: "medications", label: "Medications & prescriptions", default: true },
  { value: "lab_results", label: "Lab results", default: true },
  { value: "imaging", label: "Imaging & radiology" },
  { value: "procedures", label: "Procedures & surgeries", default: true },
  { value: "documents", label: "Source documents" },
];

export function GrantConsentForm({
  practitioners,
  organizations,
}: {
  practitioners: GranteeOption[];
  organizations: GranteeOption[];
}) {
  const [state, action] = useActionState(grantConsentAction, {});
  const formRef = useFocusFirstError(state.error);
  const granteeError =
    state.error === "Choose a doctor or facility and at least one data category."
      ? "Choose a verified doctor or facility."
      : state.error === "Practitioner not found." || state.error === "Organization not found." || state.error === "Invalid grantee."
        ? state.error
        : undefined;
  const scopesError =
    state.error === "Choose a doctor or facility and at least one data category."
      ? "Select at least one data category."
      : undefined;

  return (
    <form ref={formRef} action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <Field label="Grant access to" htmlFor="granteeId" error={granteeError}>
        <Select
          id="granteeId"
          name="granteeId"
          required
          aria-invalid={granteeError ? true : undefined}
          aria-describedby={granteeError ? "granteeId-error" : undefined}
          defaultValue=""
        >
          <option value="" disabled>
            Choose a verified doctor or facility…
          </option>
          <optgroup label="Doctors">
            {practitioners.map((p) => (
              <option key={p.id} value={`practitioner:${p.id}`}>
                {p.label} — {p.sub}
              </option>
            ))}
          </optgroup>
          <optgroup label="Facilities">
            {organizations.map((o) => (
              <option key={o.id} value={`organization:${o.id}`}>
                {o.label} — {o.sub}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-2 block text-[13px] font-medium text-ink">
          What can they see?
        </legend>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SCOPES.map((s) => (
            <label
              key={s.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 text-[13px] transition-colors has-checked:border-pine has-checked:bg-pine-tint"
            >
              <input
                type="checkbox"
                name="scopes"
                value={s.value}
                defaultChecked={s.default}
                className="h-4 w-4 accent-pine"
              />
              <span className="text-ink">{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purpose" htmlFor="purpose">
          <Select id="purpose" name="purpose" defaultValue="treatment">
            <option value="treatment">Treatment</option>
            <option value="consultation">Consultation</option>
            <option value="emergency">Emergency</option>
            <option value="record_review">Record review</option>
          </Select>
        </Field>
        <Field label="Valid for (days)" htmlFor="days">
          <Input id="days" name="days" type="number" min={1} max={365} defaultValue={7} />
        </Field>
      </div>

      <p className="text-xs text-ink-faint">
        You can revoke at any time — access stops immediately. Every use is logged.
      </p>
      <FormErrorSummary errors={[state.error, granteeError, scopesError]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">{state.ok}</p>
      ) : null}
      <SubmitButton pendingLabel="Granting…">Grant access</SubmitButton>
    </form>
  );
}

export function RevokeConsentButton({ consentId }: { consentId: string }) {
  const [state, action] = useActionState(revokeConsentAction, {});
  const router = useRouter();

  // Row reflects the revocation immediately; server revalidation follows.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (state.ok) {
    return <Badge tone="neutral">revoked</Badge>;
  }

  return (
    <form action={action} className="inline">
      <input type="hidden" name="consentId" value={consentId} />
      <SubmitButton variant="danger" size="sm" pendingLabel="Revoking…">
        Revoke
      </SubmitButton>
      {state.error ? <span className="ml-2 text-xs text-alert">{state.error}</span> : null}
    </form>
  );
}

export function ScopeBadges({ scopes }: { scopes: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {scopes.map((s) => (
        <Badge key={s}>{s.replace(/_/g, " ")}</Badge>
      ))}
    </span>
  );
}
