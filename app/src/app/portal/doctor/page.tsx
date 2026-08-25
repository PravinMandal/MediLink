export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt, desc } from "drizzle-orm";
import { PageHeader, Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { consents, patients } from "@/server/db/schema";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { consent, SCOPE_LABELS, type ConsentScope } from "@/server/modules/consent/service";
import { PatientLookupForm, HandoffRedeemForm } from "@/components/patient-search";
import { initials, daysUntil } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Find a patient",
  description: "Look up a patient by ID or verified ABHA, redeem a sharing code, and request access.",
};

const PURPOSE_LABEL: Record<string, string> = {
  treatment: "Treatment",
  consultation: "Consultation",
  emergency: "Emergency",
  record_review: "Record review",
};

export default async function DoctorHome() {
  const user = await requireUser();
  const practitioner = await getPractitionerForUser(user.id);

  // Fire-and-forget: expire lapsed grants so this grantee-side list never
  // shows stale "active" consents (patient-side consents page does the same).
  void consent.expireStale().catch(() => undefined);

  if (!practitioner) {
    return (
      <>
        <PageHeader eyebrow="Doctor portal" title="Find a patient" />
        <Card className="p-6">
          <EmptyState
            title="Verification in progress"
            body="Submit your council registration to unlock patient lookup and records."
          />
        </Card>
      </>
    );
  }

  if (practitioner.verificationStatus !== "verified") {
    return (
      <>
        <PageHeader eyebrow="Doctor portal" title="Find a patient" />
        <Card className="p-6">
          <div className="space-y-3 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              Verification {practitioner.verificationStatus}
            </p>
            <p className="mx-auto max-w-md text-sm text-ink-soft">
              Your registration ({practitioner.registrationNumber}
              {practitioner.council ? `, ${practitioner.council}` : ""}) is in the review queue.
              Lookup unlocks once a platform reviewer approves it.
            </p>
            <Badge tone="amber">Pending review</Badge>
          </div>
        </Card>
      </>
    );
  }

  // My patients: only patients with a current authorization to this
  // practitioner. Initials/name appear here because consent exists.
  const grants = await db
    .select({
      patientId: patients.id,
      fullName: patients.fullName,
      purpose: consents.purpose,
      scopes: consents.scopes,
      expiresAt: consents.expiresAt,
    })
    .from(consents)
    .innerJoin(patients, eq(patients.id, consents.patientId))
    .where(
      and(
        eq(consents.granteePractitionerId, practitioner.id),
        eq(consents.status, "active"),
        gt(consents.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(consents.createdAt))
    .limit(50);

  return (
    <>
      <PageHeader
        eyebrow="Doctor portal"
        title="Find a patient"
        description="Look up a Patient ID or verified ABHA — never a name or phone directory. You see a record only after the patient approves your request."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Identifier lookup"
            title="Patient ID or verified ABHA"
          />
          <div className="px-4 py-4 sm:px-5">
            <PatientLookupForm />
            <p className="mt-3 text-xs text-ink-faint">
              Before the patient approves, a lookup reveals only that a record may exist —
              no name, demographics, or clinical data.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Patient-present handoff"
            title="Patient is with me"
          />
          <div className="px-4 py-4 sm:px-5">
            <HandoffRedeemForm />
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader
            eyebrow="Workspace"
            title="My patients"
            action={
              <Link
                href="/portal/doctor/patients"
                className="text-[13px] font-medium text-pine underline underline-offset-2"
              >
                Open full list ({grants.length}) →
              </Link>
            }
          />
          {grants.length ? (
            <ul className="divide-y divide-line">
              {grants.slice(0, 4).map((g) => {
                const scopes = (g.scopes as ConsentScope[]).map((s) => SCOPE_LABELS[s] ?? s);
                return (
                  <li
                    key={g.patientId}
                    className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r bg-pine"
                    />
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden
                        className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-paper-sunk text-[11px] font-semibold text-ink"
                      >
                        {initials(g.fullName)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{g.fullName}</p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {PURPOSE_LABEL[g.purpose] ?? g.purpose}
                          {scopes.length ? ` · ${scopes.slice(0, 3).join(", ")}` : ""}
                          {scopes.length > 3 ? ` +${scopes.length - 3} more` : ""}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/portal/doctor/patients/${g.patientId}`}
                      className="glass-hover rounded-lg border border-line-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink"
                    >
                      Open →
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-6 sm:px-5">
              <EmptyState
                title="No active access yet"
                body="Look up a Patient ID or redeem a sharing code above to send an access request. Patients you have access to appear here with purpose, scopes, and expiry."
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
