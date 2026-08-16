export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Badge, EmptyState, Alert } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { consent } from "@/server/modules/consent/service";
import {
  listVerifiedOrganizations,
  getPractitionerForUser,
} from "@/server/modules/identity/verification";
import { db } from "@/server/db";
import { practitioners } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { GrantConsentForm, RevokeConsentButton, ScopeBadges } from "@/components/consent-forms";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Consents" };

const STATUS_TONE: Record<string, "pine" | "neutral" | "amber"> = {
  active: "pine",
  revoked: "neutral",
  expired: "amber",
};

export default async function PatientConsents() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  await consent.expireStale();
  const [grants, verifiedOrgs, verifiedPractitioners, me] = await Promise.all([
    consent.listForPatient(patient.id),
    listVerifiedOrganizations(),
    db
      .select({
        id: practitioners.id,
        fullName: practitioners.fullName,
        specialty: practitioners.specialty,
        organizationId: practitioners.organizationId,
      })
      .from(practitioners)
      .where(eq(practitioners.verificationStatus, "verified")),
    getPractitionerForUser(user.id),
  ]);
  void me;

  const orgOptions = verifiedOrgs.map((o) => ({
    id: o.id,
    label: o.name,
    sub: o.type.replace(/_/g, " "),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Consent & access control"
        description="Nobody reads your record without a grant from you — or an audited emergency."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="New grant" title="Give a doctor access" />
          <GrantConsentForm
            practitioners={verifiedPractitioners.map((p) => ({
              id: p.id,
              label: p.fullName,
              sub: p.specialty ?? "Medicine",
            }))}
            organizations={orgOptions}
          />
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              eyebrow="Your data, your rules"
              title="Active & past grants"
              action={<Badge tone="pine">{grants.filter((g) => g.status === "active").length} active</Badge>}
            />
            {grants.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No grants yet"
                  body="When a doctor requests access, grant it here in two taps."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {grants.map((g) => (
                  <li key={g.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{g.grantee}</p>
                      <div className="flex items-center gap-2">
                        <Badge tone={STATUS_TONE[g.status] ?? "neutral"}>{g.status}</Badge>
                        {g.status === "active" ? (
                          <RevokeConsentButton consentId={g.id} />
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2">
                      <ScopeBadges scopes={g.scopes} />
                    </div>
                    <p className="mt-1.5 text-xs text-ink-soft">
                      {g.purpose} · granted {formatDate(g.grantedAt)} · expires{" "}
                      {formatDate(g.expiresAt)}
                      {g.revokedAt ? ` · revoked ${formatDate(g.revokedAt)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Alert tone="pine" title="Consent, by design">
            Grants expire automatically. Revoking is instant. Emergency access is a separate,
            always-audited pathway — a doctor must state a clinical reason and you are notified.
          </Alert>
        </div>
      </div>
    </>
  );
}
