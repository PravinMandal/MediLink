"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  reviewPractitionerAction,
  reviewOrganizationAction,
  reviewEmergencyAction,
  verifyAuditChainAction,
  setUserRoleAction,
} from "@/server/actions/admin-actions";
import { Field, Select, Textarea, FormErrorSummary } from "./ui";
import { SubmitButton, useFocusFirstError } from "./interactive";

type FormState = { error?: string; ok?: string };

function ReviewButtons({
  action,
  idName,
  id,
  approveLabel = "Approve",
  rejectLabel = "Reject",
  confirmReject,
  rejectVerb,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  idName: string;
  id: string;
  approveLabel?: string;
  rejectLabel?: string;
  confirmReject: string;
  rejectVerb: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  // Successful review removes the item from the pending queue; refresh for
  // the server list to settle.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <span role="status" className="text-xs font-medium text-pine">
        {state.ok}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {confirming ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name={idName} value={id} />
          <input
            type="hidden"
            name={idName === "eventId" ? "status" : "approve"}
            value={idName === "eventId" ? "flagged" : "0"}
          />
          <span className="text-xs text-alert">{confirmReject}</span>
          <SubmitButton
            variant="danger"
            size="sm"
            pendingLabel={rejectVerb + "…"}
          >
            Yes, {rejectVerb.toLowerCase()}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="cursor-pointer rounded-lg border border-line-strong bg-paper-raised px-2.5 h-8 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name={idName} value={id} />
            <input type="hidden" name="approve" value="1" />
            <input
              type="hidden"
              name={idName === "eventId" ? "status" : "approve"}
              value={idName === "eventId" ? "reviewed" : "1"}
            />
            <SubmitButton size="sm" pendingLabel="…">
              {approveLabel}
            </SubmitButton>
          </form>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="cursor-pointer rounded-lg border border-line-strong bg-paper-raised px-2.5 h-8 text-[13px] font-medium text-ink-soft transition-colors hover:border-alert hover:text-alert"
          >
            {rejectLabel}
          </button>
        </>
      )}
      {state.error ? <span role="alert" className="text-xs text-alert">{state.error}</span> : null}
    </div>
  );
}

export function ReviewPractitionerButtons({ practitionerId }: { practitionerId: string }) {
  return (
    <ReviewButtons
      action={reviewPractitionerAction}
      idName="practitionerId"
      id={practitionerId}
      confirmReject="Rejecting sends the doctor back to fix their registration."
      rejectVerb="Reject"
    />
  );
}

export function ReviewOrganizationButtons({ organizationId }: { organizationId: string }) {
  return (
    <ReviewButtons
      action={reviewOrganizationAction}
      idName="organizationId"
      id={organizationId}
      confirmReject="Rejecting withholds the facility's verified badge."
      rejectVerb="Reject"
    />
  );
}

export function ReviewEmergencyButtons({ eventId }: { eventId: string }) {
  return (
    <ReviewButtons
      action={reviewEmergencyAction}
      idName="eventId"
      id={eventId}
      approveLabel="Mark reviewed"
      rejectLabel="Flag"
      confirmReject="Flagging marks this emergency access as inappropriate — it will be investigated."
      rejectVerb="Flag"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Audit chain verification (H2)                                       */
/* ------------------------------------------------------------------ */

type VerifyState = FormState & { brokenAt?: number | null };

// useActionState's adapter signature needs named params it ignores; keeping
// the wrapper named avoids unused-var lint noise inline.
async function verifyAuditChainWrapper(): Promise<VerifyState> {
  return verifyAuditChainAction();
}

export function VerifyAuditChainButton() {
  const [state, action] = useActionState<VerifyState, FormData>(
    verifyAuditChainWrapper,
    {},
  );

  return (
    <div className="space-y-3 px-4 py-4 sm:px-5">
      <form action={action}>
        <SubmitButton pendingLabel="Verifying chain…">Verify audit chain</SubmitButton>
      </form>
      {state.ok && state.brokenAt == null ? (
        <p role="status" className="text-[13px] font-medium text-pine">
          Chain intact — no tampering detected.
        </p>
      ) : null}
      {state.brokenAt != null ? (
        <p role="alert" className="text-[13px] font-medium text-alert">
          CHAIN BROKEN at seq #{state.brokenAt}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-[13px] font-medium text-alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grant role (H2) — professional roles are admin-granted only         */
/* ------------------------------------------------------------------ */

const GRANTABLE_ROLE_OPTIONS = [
  { value: "doctor", label: "Doctor" },
  { value: "lab_staff", label: "Lab staff" },
  { value: "org_admin", label: "Organization admin" },
];

export function GrantRoleForm({
  users,
}: {
  users: Array<{ id: string; name: string; email: string; role: string }>;
}) {
  const [state, action] = useActionState(setUserRoleAction, {});
  const formRef = useFocusFirstError(state.error);
  return (
    <form ref={formRef} action={action} className="space-y-4 px-4 py-4 sm:px-5">
      <Field label="User" htmlFor="gr-user" hint="Platform admins are excluded.">
        <Select id="gr-user" name="userId" required defaultValue="">
          <option value="" disabled>
            Choose a user…
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.email} ({u.role.replace(/_/g, " ")})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Role" htmlFor="gr-role">
        <Select id="gr-role" name="role" defaultValue="doctor">
          {GRANTABLE_ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reason" htmlFor="gr-reason" hint="Recorded in the audit log.">
        <Textarea
          id="gr-reason"
          name="reason"
          required
          rows={3}
          placeholder="e.g. Council registration verified offline (MMC/2010/45231)"
        />
      </Field>
      <FormErrorSummary errors={[state.error]} />
      {state.ok ? (
        <p role="status" className="text-[13px] font-medium text-pine">
          {state.ok}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Granting…">Grant role</SubmitButton>
    </form>
  );
}
