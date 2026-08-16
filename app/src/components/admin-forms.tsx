"use client";

import { useActionState } from "react";
import {
  reviewPractitionerAction,
  reviewOrganizationAction,
  reviewEmergencyAction,
} from "@/server/actions/admin-actions";
import { SubmitButton } from "./interactive";

function ReviewButtons({
  action,
  idName,
  id,
  approveLabel = "Approve",
  rejectLabel = "Reject",
}: {
  action: (prev: { error?: string; ok?: string }, fd: FormData) => Promise<{ error?: string; ok?: string }>;
  idName: string;
  id: string;
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name={idName} value={id} />
      <input type="hidden" name="approve" value="1" />
      <SubmitButton size="sm" pendingLabel="…">{approveLabel}</SubmitButton>
      <button
        type="submit"
        name={idName === "practitionerId" || idName === "organizationId" ? "approve" : "status"}
        value={idName === "eventId" ? "flagged" : "0"}
        className="cursor-pointer rounded-md border border-line-strong bg-paper-raised px-2.5 h-8 text-[13px] font-medium text-ink-soft transition-colors hover:border-alert hover:text-alert"
      >
        {rejectLabel}
      </button>
      {state.error ? <span className="text-xs text-alert">{state.error}</span> : null}
      {state.ok ? <span className="text-xs text-pine">✓</span> : null}
    </form>
  );
}

export function ReviewPractitionerButtons({ practitionerId }: { practitionerId: string }) {
  return <ReviewButtons action={reviewPractitionerAction} idName="practitionerId" id={practitionerId} />;
}

export function ReviewOrganizationButtons({ organizationId }: { organizationId: string }) {
  return <ReviewButtons action={reviewOrganizationAction} idName="organizationId" id={organizationId} />;
}

export function ReviewEmergencyButtons({ eventId }: { eventId: string }) {
  return (
    <ReviewButtons
      action={reviewEmergencyAction}
      idName="eventId"
      id={eventId}
      approveLabel="Mark reviewed"
      rejectLabel="Flag"
    />
  );
}
