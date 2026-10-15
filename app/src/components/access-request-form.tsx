"use client";

import { useActionState } from "react";
import { requestAccessAction } from "@/server/actions/patient-actions";
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
