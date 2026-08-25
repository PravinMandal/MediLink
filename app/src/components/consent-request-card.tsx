"use client";

import { useActionState } from "react";
import { grantConsentAction } from "@/server/actions/patient-actions";
import type { FormState } from "@/server/actions/auth-actions";
import { SubmitButton } from "@/components/interactive";
import { ScopeBadges } from "@/components/consent-forms";

export type ConsentRequestView = {
  key: string;
  practitionerId: string;
  practitionerName: string;
  specialty: string | null;
  requestedAt: string;
  purposes: string;
};

const DEFAULT_SCOPES = ["demographics", "conditions", "allergies", "medications", "lab_results"];

/**
 * One-tap consent-request card: the doctor's request arrives pre-filled
 * (grantee, default scopes, 30-day expiry); Grant is a single click.
 */
export function ConsentRequestCard({ req }: { req: ConsentRequestView }) {
  const [state, action] = useActionState<FormState, FormData>(grantConsentAction, {});
  return (
    <form
      action={action}
      className="rounded-lg border border-pine/40 bg-pine-tint px-4 py-3.5 sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">{req.practitionerName}</p>
          <p className="text-xs text-ink-soft">
            {req.specialty ?? "Medicine"} · requested {req.requestedAt} · {req.purposes}
          </p>
        </div>
        <span className="seal">wants access</span>
      </div>
      <div className="mt-2">
        <ScopeBadges scopes={DEFAULT_SCOPES} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {DEFAULT_SCOPES.map((s) => (
          <input key={s} type="hidden" name="scopes" value={s} />
        ))}
        <input type="hidden" name="granteeId" value={`practitioner:${req.practitionerId}`} />
        <input type="hidden" name="days" value="30" />
        <input type="hidden" name="purpose" value="treatment" />
        <SubmitButton pendingLabel="Granting…">Grant 30-day access</SubmitButton>
        <label className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <input type="checkbox" name="scopes" value="documents" className="accent-pine" />
          include documents
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <input type="checkbox" name="scopes" value="imaging" className="accent-pine" />
          include imaging
        </label>
      </div>
      {state.error ? <p className="mt-2 text-xs text-alert">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-xs text-pine">{state.ok}</p> : null}
    </form>
  );
}
