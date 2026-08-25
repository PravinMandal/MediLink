export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Badge, EmptyState, Alert } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { consent, SCOPE_LABELS, OFFERED_SCOPES } from "@/server/modules/consent/service";
import { accessRequestsService } from "@/server/modules/consent/access-requests";
import {
  PendingAccessRequestCard,
  ConsentReceipt,
  type PendingRequestView,
  type GrantView,
} from "@/components/access-centre";
import { RevokeConsentButton } from "@/components/consent-forms";
import { formatIst } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Access centre",
  description: "Decide who can see your record, for how long, and stop access at any time.",
};

const STATUS_TONE: Record<string, "pine" | "neutral" | "amber"> = {
  active: "pine",
  revoked: "neutral",
  expired: "amber",
};

const PURPOSE_LABEL: Record<string, string> = {
  treatment: "Ongoing treatment",
  consultation: "Consultation",
  emergency: "Emergency care",
  record_review: "Record review",
};

export default async function PatientAccessCentre() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const pending = await accessRequestsService.pendingForPatient(patient.id);

  // Mark requests as viewed (§7.8); tolerate individual failures.
  if (pending.length) {
    await Promise.all(
      pending.map((r) =>
        accessRequestsService.markViewed(user.id, r.id).catch(() => undefined),
      ),
    );
  }

  const grants = await consent.listForPatient(patient.id);
  const artifacts = await Promise.all(
    grants.map(async (g) => {
      if (g.status !== "active") return null;
      try {
        const a = await accessRequestsService.artifactForConsent(g.id);
        if (!a) return null;
        return {
          code: a.receiptCode,
          hashFragment: a.artifactSha256.slice(0, 12).toUpperCase(),
        };
      } catch {
        return null;
      }
    }),
  );

  const offeredScopes = OFFERED_SCOPES.map((s) => ({ scope: s, label: SCOPE_LABELS[s] }));

  const pendingViews: PendingRequestView[] = pending.map((r) => {
    const suggested = (r.suggestedScopes ?? []) as string[];
    const excluded = offeredScopes.filter((s) => !suggested.includes(s.scope));
    return {
      id: r.id,
      who: {
        name: r.requesterSnapshot.name,
        credentialStatus: r.requesterSnapshot.credentialStatus,
        organization: r.requesterSnapshot.organization ?? null,
        specialty: r.requesterSnapshot.specialty ?? null,
      },
      why: {
        purpose: r.purpose,
        purposeDetail: r.purposeDetail ?? null,
        visitReference: r.visitReference ?? null,
      },
      suggestedScopes: suggested,
      excludedScopes: excluded,
      offeredScopes,
      requestedDays: r.requestedDays,
      requestedAt: r.submittedAt?.toISOString() ?? r.createdAt.toISOString(),
      wouldExpireAt: new Date(
        new Date(r.submittedAt ?? r.createdAt).getTime() +
          r.requestedDays * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  });

  const grantViews: GrantView[] = grants.map((g, i) => ({
    id: g.id,
    grantee: g.grantee,
    purpose: g.purpose,
    scopes: g.scopes as string[],
    grantedAt: g.grantedAt.toISOString(),
    expiresAt: g.expiresAt.toISOString(),
    revokedAt: g.revokedAt?.toISOString() ?? null,
    status: g.status,
    receipt: artifacts[i] ?? null,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Access centre"
        description="Nobody reads your record without a decision from you — and you can stop access at any time."
      />

      <div className="space-y-5">
        {/* Pending requests come first (§7.8) */}
        <Card>
          <CardHeader
            eyebrow="Access requests"
            title={
              pendingViews.length
                ? `${pendingViews.length} request${pendingViews.length > 1 ? "s" : ""} waiting for your decision`
                : "No requests waiting"
            }
            action={pendingViews.length ? <Badge tone="amber">Action needed</Badge> : undefined}
          />
          {pendingViews.length ? (
            <div className="space-y-4 px-4 py-4 sm:px-5">
              {pendingViews.map((r) => (
                <PendingAccessRequestCard key={r.id} req={r} />
              ))}
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="Nothing to decide"
                body="When a clinician asks for access, their request appears here with exactly who they are and what they want to see."
              />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="Your data, your rules"
            title="Active & past grants"
            action={
              <Badge tone="pine">
                {grantViews.filter((g) => g.status === "active").length} active
              </Badge>
            }
          />
          {grantViews.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No grants yet"
                body="Once you approve a request, the grant appears here with its exact scope, expiry, and a consent receipt."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {grantViews.map((g) => (
                <li key={g.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{g.grantee}</p>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[g.status] ?? "neutral"}>{g.status}</Badge>
                      {g.status === "active" ? <RevokeConsentButton consentId={g.id} /> : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {PURPOSE_LABEL[g.purpose] ?? g.purpose.replace(/_/g, " ")} · granted{" "}
                    {formatIst(g.grantedAt)}
                    {g.status === "active"
                      ? ` · access expires ${formatIst(g.expiresAt)}`
                      : g.revokedAt
                        ? ` · revoked ${formatIst(g.revokedAt)}`
                        : ` · expired ${formatIst(g.expiresAt)}`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.scopes.map((s) => (
                      <Badge key={s}>{SCOPE_LABELS[s as keyof typeof SCOPE_LABELS] ?? s}</Badge>
                    ))}
                  </div>
                  <ConsentReceipt receipt={g.receipt} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Alert tone="pine" title="Consent, by design">
          Grants expire automatically at the exact time shown. Revoking is instant. Emergency
          access is a separate, always-audited pathway — a doctor must state a clinical reason
          and you are notified.
        </Alert>
      </div>
    </>
  );
}
