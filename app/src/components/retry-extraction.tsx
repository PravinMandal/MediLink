"use client";

import { useActionState } from "react";
import { retryExtractionAction } from "@/server/actions/doctor-actions";
import type { FormState } from "@/server/actions/auth-actions";
import { SubmitButton } from "@/components/interactive";

/** Retry chip for failed/stale document extractions. */
export function RetryExtractionButton({
  patientId,
  documentId,
}: {
  patientId: string;
  documentId: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    retryExtractionAction,
    {},
  );
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="documentId" value={documentId} />
      <SubmitButton
        pendingLabel="Retrying…"
        className="cursor-pointer rounded-lg border border-amber/60 bg-amber/10 px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-amber"
      >
        Retry extraction
      </SubmitButton>
      {state.ok ? <span className="text-[11px] text-pine">{state.ok}</span> : null}
      {state.error ? <span className="text-[11px] text-alert">{state.error}</span> : null}
    </form>
  );
}
