export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Card, EmptyState, Badge, Alert } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { consent } from "@/server/modules/consent/service";
import { PatientSearchForm } from "@/components/patient-search";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Patients", description: "Search for a patient and open their consent-scoped record." };

export default async function DoctorHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const practitioner = await getPractitionerForUser(user.id);

  // Fire-and-forget: expire lapsed grants so this grantee-side list never
  // shows stale "active" consents (patient-side consents page does the same).
  void consent.expireStale().catch(() => undefined);

  if (!practitioner) {
    return (
      <>
        <PageHeader eyebrow="Doctor portal" title="Patients" />
        <Alert tone="info" title="Verification in progress">
          Submit your council registration to unlock patient search and records.
        </Alert>
      </>
    );
  }

  if (practitioner.verificationStatus !== "verified") {
    return (
      <>
        <PageHeader eyebrow="Doctor portal" title="Patients" />
        <Card className="p-6">
          <div className="space-y-3 text-center">
            <p className="font-display text-lg font-semibold text-ink">
              Verification {practitioner.verificationStatus}
            </p>
            <p className="mx-auto max-w-md text-sm text-ink-soft">
              Your registration ({practitioner.registrationNumber}
              {practitioner.council ? `, ${practitioner.council}` : ""}) is in the review queue.
              Search unlocks once a platform reviewer approves it.
            </p>
            <Badge tone="amber">Pending review</Badge>
          </div>
        </Card>
      </>
    );
  }

  const results = q?.trim() ? await patientService.search(q.trim()) : [];
  const withAccess = await Promise.all(
    results.map(async (p) => ({
      ...p,
      access: await consent.activeForPractitioner(p.id, practitioner.id),
    })),
  );

  return (
    <>
      <PageHeader
        eyebrow="Doctor portal"
        title="Find a patient"
        description="Search by name or phone. You see a patient's record only with their consent — or through audited emergency access."
      />

      <PatientSearchForm initialQuery={q} />

      {q?.trim() ? (
        withAccess.length === 0 ? (
          <EmptyState title={`No patients match “${q.trim()}”`} body="Try a name fragment or phone digits." />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {withAccess.map((p) => {
                const expiring = p.access.find((a) => a.expiresAt);
                const soonest = expiring?.expiresAt;
                return (
                <li key={p.id} className="relative flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  {/* Chain motif: consent state as a ruled dot on the row's left edge */}
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r ${
                      p.access.length ? "bg-pine" : "bg-amber/70"
                    }`}
                  />
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Leading initials chip — consistent with portal header */}
                    <span
                      aria-hidden
                      className="num flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-paper-sunk text-[11px] font-semibold text-ink"
                    >
                      {initials(p.fullName)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {p.fullName}
                        <span className="ml-2 text-xs font-normal text-ink-soft">
                          {p.sex ?? ""} {p.dob ? `· b. ${formatDate(p.dob, "short")}` : ""}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {p.phone ?? "no phone"} {p.addressCity ? `· ${p.addressCity}` : ""}
                      </p>
                      {p.access.length ? (
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {p.access.length} active grant{p.access.length > 1 ? "s" : ""}
                          {p.access[0]?.scopes?.length
                            ? ` · ${p.access[0].scopes.length} scopes`
                            : ""}
                          {soonest ? ` · expires ${formatDate(soonest, "short")}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {p.access.length ? (
                      <Badge tone="pine">Consent active</Badge>
                    ) : (
                      <Badge tone="amber">No consent</Badge>
                    )}
                    <Link
                      href={`/portal/doctor/patients/${p.id}`}
                      className="rounded-md border border-line-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink-faint"
                    >
                      Open →
                    </Link>
                  </div>
                </li>
                );
              })}
            </ul>
          </Card>
        )
      ) : (
        <EmptyState
          title="Search to open a patient"
          body="With their consent you'll see the full longitudinal story — timeline, cited summary, trends, and source documents."
        />
      )}
    </>
  );
}
