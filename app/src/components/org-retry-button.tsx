"use client";

import { useActionState } from "react";
import { retryExtractionAction } from "@/server/actions/doctor-actions";
import type { FormState } from "@/server/actions/auth-actions";
import { SubmitButton } from "@/components/interactive";

/** Org-console retry chip for failed document extractions. */
export function OrgRetryButton({
  documentId,
  patientId,
}: {
  documentId: string;
  patientId: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(retryExtractionAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="documentId" value={documentId} />
      <SubmitButton
        pendingLabel="Retrying…"
        className="cursor-pointer rounded-lg border border-amber/60 bg-amber/10 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-amber"
      >
        Retry
      </SubmitButton>
      {state.ok ? <span className="ml-2 text-[11px] text-pine">{state.ok}</span> : null}
      {state.error ? <span className="ml-2 text-[11px] text-alert">{state.error}</span> : null}
    </form>
  );
}
