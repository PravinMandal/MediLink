export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Badge, Alert } from "@/components/ui";
import { requireUser } from "@/server/session";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { VerificationForm } from "@/components/doctor-forms";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Verification" };

export default async function DoctorVerification() {
  const user = await requireUser();
  const practitioner = await getPractitionerForUser(user.id);

  if (practitioner) {
    const status = practitioner.verificationStatus;
    return (
      <>
        <PageHeader
          eyebrow="Doctor portal"
          title="Practitioner verification"
          description="Your credentials gate what you can do on MediLink — only verified professionals create records."
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              eyebrow="Status"
              title={
                status === "verified" ? "Verified practitioner" : `Verification ${status}`
              }
              action={
                status === "verified" ? (
                  <span className="seal">✓ Verified</span>
                ) : (
                  <Badge tone={status === "pending" ? "amber" : "alert"}>{status}</Badge>
                )
              }
            />
            <dl className="divide-y divide-line text-sm">
              {[
                ["Name", practitioner.fullName],
                ["Registration no.", practitioner.registrationNumber],
                ["Council", practitioner.council ?? "—"],
                ["Qualification", practitioner.qualification ?? "—"],
                ["Specialty", practitioner.specialty ?? "—"],
                ["Verified on", practitioner.verifiedAt ? formatDate(practitioner.verifiedAt) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="text-right text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <div className="space-y-4">
            {status === "verified" ? (
              <Alert tone="pine" title="You’re cleared to practice on MediLink">
                You can search patients, read consented records, contribute verified clinical
                data, and generate cited summaries.
              </Alert>
            ) : status === "pending" ? (
              <Alert tone="amber" title="In the review queue">
                A platform reviewer checks your council registration. Typical turnaround: 1–2
                working days. You’ll be notified.
              </Alert>
            ) : (
              <Alert tone="alert" title="Verification rejected">
                Contact support with corrected registration details, then resubmit.
              </Alert>
            )}
            <Alert tone="info" title="Coming with ABDM integration">
              Verification will cross-check the Healthcare Professionals Registry (HPR)
              automatically — the adapter is already in place.
            </Alert>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Doctor portal"
        title="Practitioner verification"
        description="One-time check against your state medical council registration."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Step 1 of 1" title="Submit your credentials" />
          <VerificationForm />
        </Card>
        <div className="space-y-4">
          <Alert tone="info" title="Why we verify">
            Every record on MediLink carries its author’s verified identity — that’s what makes
            the provenance chain worth trusting. Your details are never shown to patients beyond
            your name and specialty.
          </Alert>
        </div>
      </div>
    </>
  );
}
