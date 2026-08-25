"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  decideAccessRequestAction,
  reportConcernAction,
} from "@/server/actions/discovery-actions";
import type { FormState } from "@/server/actions/auth-actions";
import { Badge, Field, Input, FormErrorSummary } from "@/components/ui";
import { SubmitButton } from "@/components/interactive";
import { formatIst } from "@/lib/utils";

/**
 * Access centre client components (BuildPlan §7.8). Scope names, labels and
 * pre-formatted datetimes arrive from the server page; nothing here decides
 * what a suggested scope implies — no checkbox is ever preselected.
 */

export type PendingRequestView = {
  id: string;
  who: {
    name: string;
    credentialStatus: string;
    organization: string | null;
    specialty: string | null;
  };
  why: { purpose: string; purposeDetail: string | null; visitReference: string | null };
  suggestedScopes: string[];
  excludedScopes: Array<{ scope: string; label: string }>;
  offeredScopes: Array<{ scope: string; label: string }>;
  requestedDays: number;
  requestedAt: string;
  wouldExpireAt: string;
};

export type GrantView = {
  id: string;
  grantee: string;
  purpose: string;
  scopes: string[];
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: string;
  receipt: { code: string; hashFragment: string } | null;
};

const CREDENTIAL_LABEL: Record<string, string> = {
  verified: "Verified clinician",
  pending: "Verification pending",
  unverified: "Not yet verified",
  expired: "Verification expired",
};

const PURPOSE_LABEL: Record<string, string> = {
  treatment: "Ongoing treatment",
  consultation: "A consultation",
  emergency: "Emergency care",
  record_review: "Reviewing your record",
};

function ExpiryPreview({ days, base }: { days: number; base: string }) {
  return (
    <span className="num">
      {days} day{days > 1 ? "s" : ""} — until {formatIst(
        new Date(new Date(base).getTime() + days * 24 * 60 * 60 * 1000),
      )}
    </span>
  );
}

export function PendingAccessRequestCard({ req }: { req: PendingRequestView }) {
  const router = useRouter();
  const [mode, setMode] = useState<"summary" | "grant" | "decline" | "concern">("summary");
  const [state, action] = useActionState<FormState, FormData>(decideAccessRequestAction, {});
  const [concernState, concernAction] = useActionState<FormState, FormData>(
    reportConcernAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const credential = CREDENTIAL_LABEL[req.who.credentialStatus] ?? req.who.credentialStatus;
  const purpose = PURPOSE_LABEL[req.why.purpose] ?? req.why.purpose.replace(/_/g, " ");

  return (
    <article className="rounded-lg border border-amber/50 bg-amber-tint px-4 py-4 sm:px-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">{req.who.name}</p>
          <p className="text-xs text-ink-soft">
            {[credential, req.who.organization, req.who.specialty]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Badge tone="amber">Waiting for your decision</Badge>
      </header>

      {/* Who is asking / Why / What they will and will not see / For how long */}
      <dl className="mt-3 space-y-2.5 text-[13px]">
        <div>
          <dt className="eyebrow">Why they are asking</dt>
          <dd className="text-ink">
            {purpose}
            {req.why.purposeDetail ? ` — ${req.why.purposeDetail}` : ""}
            {req.why.visitReference ? (
              <span className="text-ink-soft"> (visit: {req.why.visitReference})</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">What they asked to see</dt>
          <dd className="text-ink">
            {req.suggestedScopes.length ? (
              <>
                Requested by {req.who.name.split(" ")[0]}:{" "}
                {req.suggestedScopes
                  .map((s) => req.offeredScopes.find((o) => o.scope === s)?.label ?? s)
                  .join(", ")}
                . You choose exactly what to approve below — nothing is selected for you.
              </>
            ) : (
              "No categories were suggested. You choose exactly what to approve."
            )}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">What they will not see</dt>
          <dd className="text-ink-soft">
            {req.excludedScopes.length
              ? req.excludedScopes.map((s) => s.label).join(", ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">For how long</dt>
          <dd className="text-ink">
            <ExpiryPreview days={req.requestedDays} base={new Date().toISOString()} /> at most —
            you can shorten this when granting.
          </dd>
        </div>
        <div>
          <dt className="eyebrow">If you decline</dt>
          <dd className="text-ink-soft">
            They will not be able to open your MediLink record. You can still share documents
            another way.
          </dd>
        </div>
      </dl>

      {mode === "summary" ? (
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setMode("grant")}
            className="rounded-lg bg-pine px-3.5 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
          >
            Review and grant
          </button>
          <button
            type="button"
            onClick={() => setMode("decline")}
            className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-line/40"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setMode("concern")}
            className="text-[13px] font-medium text-alert underline underline-offset-2"
          >
            Report concern
          </button>
        </div>
      ) : null}

      {state.ok ? (
        <p role="status" className="mt-3 text-[13px] font-medium text-pine">
          {state.ok}
        </p>
      ) : null}

      {mode === "grant" ? (
        <form action={action} className="mt-4 space-y-4 border-t border-line pt-4 print:hidden">
          <input type="hidden" name="requestId" value={req.id} />
          <input type="hidden" name="decision" value="approve" />
          <fieldset>
            <legend className="mb-1 block text-[13px] font-medium text-ink">
              Tick every category you approve. Unticked categories stay private.
            </legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {req.offeredScopes.map((s) => (
                <label
                  key={s.scope}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-2 text-[13px] transition-colors has-checked:border-pine has-checked:bg-pine-tint"
                >
                  <input
                    type="checkbox"
                    name="scopes"
                    value={s.scope}
                    className="h-4 w-4 accent-pine"
                  />
                  <span className="text-ink">
                    {s.label}
                    {req.suggestedScopes.includes(s.scope) ? (
                      <span className="text-ink-faint"> · requested</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={`Duration in days (at most ${req.requestedDays})`}
              htmlFor={`days-${req.id}`}
            >
              <Input
                id={`days-${req.id}`}
                name="days"
                type="number"
                min={1}
                max={req.requestedDays}
                defaultValue={req.requestedDays}
              />
            </Field>
            <Field label="Note for the doctor (optional)" htmlFor={`reason-${req.id}`}>
              <Input id={`reason-${req.id}`} name="reason" type="text" />
            </Field>
          </div>
          <p className="text-xs text-ink-faint">
            Access expires automatically at the end of the duration. You can revoke it sooner at
            any time.
          </p>
          <FormErrorSummary errors={[state.error]} />
          <div className="flex gap-2">
            <SubmitButton pendingLabel="Granting…">Grant access</SubmitButton>
            <button
              type="button"
              onClick={() => setMode("summary")}
              className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-line/40"
            >
              Back
            </button>
          </div>
        </form>
      ) : null}

      {mode === "decline" ? (
        <form action={action} className="mt-4 space-y-3 border-t border-line pt-4 print:hidden">
          <input type="hidden" name="requestId" value={req.id} />
          <input type="hidden" name="decision" value="decline" />
          <p className="text-[13px] text-ink-soft">
            If you decline, {req.who.name} will not be able to open your MediLink record. You can
            still share documents another way.
          </p>
          <Field label="Reason (optional)" htmlFor={`decline-reason-${req.id}`}>
            <Input id={`decline-reason-${req.id}`} name="reason" type="text" />
          </Field>
          <FormErrorSummary errors={[state.error]} />
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingLabel="Declining…">
              Decline request
            </SubmitButton>
            <button
              type="button"
              onClick={() => setMode("summary")}
              className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-line/40"
            >
              Back
            </button>
          </div>
        </form>
      ) : null}

      {mode === "concern" ? (
        <form
          action={concernAction}
          className="mt-4 space-y-3 border-t border-line pt-4 print:hidden"
        >
          <input type="hidden" name="requestId" value={req.id} />
          <p className="text-[13px] text-ink-soft">
            Reporting a concern is separate from declining. Our trust and safety team will review
            this request.
          </p>
          <Field label="What worries you?" htmlFor={`concern-${req.id}`}>
            <Input id={`concern-${req.id}`} name="reason" type="text" required />
          </Field>
          <FormErrorSummary errors={[concernState.error]} />
          {concernState.ok ? (
            <p role="status" className="text-[13px] font-medium text-pine">
              {concernState.ok}
            </p>
          ) : null}
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingLabel="Reporting…">
              Report concern
            </SubmitButton>
            <button
              type="button"
              onClick={() => setMode("summary")}
              className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-line/40"
            >
              Back
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

export function ConsentReceipt({ receipt }: { receipt: GrantView["receipt"] }) {
  if (!receipt) return null;
  return (
    <p className="mt-1.5 text-[11px] text-ink-faint">
      Consent receipt{" "}
      <span className="num">{receipt.code}</span> · receipt hash{" "}
      <span className="num">{receipt.hashFragment}</span>
    </p>
  );
}
