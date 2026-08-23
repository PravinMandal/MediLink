export const dynamic = "force-dynamic";

// Upload + after() extraction can exceed the 10s Hobby default; 60s is the
// documented D8 function cap we budget for.
export const maxDuration = 60;

import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { OrgRetryButton } from "@/components/org-retry-button";

// Module-scope for render purity (react-hooks/purity): evaluated per request.
const EXTRACTION_STALE_MS = 10 * 60 * 1000;
function effectiveStatus(d: { extractionStatus: string; createdAt: Date }): string {
  if (
    d.extractionStatus === "processing" &&
    Date.now() - d.createdAt.getTime() > EXTRACTION_STALE_MS
  )
    return "failed";
  return d.extractionStatus;
}
import { PageHeader, Card, CardHeader, Badge, Alert } from "@/components/ui";
import { db } from "@/server/db";
import { documents, organizations, user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { OrgUploadSection } from "@/components/org-upload";
import { consent } from "@/server/modules/consent/service";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Facility console", description: "Facility staff, consented patients, and recent document uploads." };

export default async function OrgConsole() {
  const user = await requireUser();

  if (!user.organizationId) {
    return (
      <>
        <PageHeader eyebrow="Facility console" title="No facility attached" />
        <Alert tone="info" title="Attach your facility">
          Your account isn’t linked to an organization yet. An existing facility admin can
          attach you, or a platform admin creates your facility.
        </Alert>
      </>
    );
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.organizationId));

  const [staff, consentedPatients, recentDocs] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name, role: userTable.role, verificationStatus: userTable.verificationStatus })
      .from(userTable)
      .where(eq(userTable.organizationId, org.id)),
    // Grant-driven, not registration-driven: any patient whose active
    // consent grants this org the documents scope can be uploaded for.
    consent.patientsWithDocumentConsent(org.id),
    db
      .select()
      .from(documents)
      .where(eq(documents.organizationId, org.id))
      .orderBy(desc(documents.createdAt))
      .limit(10),
  ]);

  const verified = org.verificationStatus === "verified";

  return (
    <>
      <PageHeader
        eyebrow="Facility console"
        title={org.name}
        description={`${org.type.replace(/_/g, " ")}${org.city ? ` · ${org.city}` : ""}`}
        action={
          verified ? (
            <span className="seal">✓ Verified facility</span>
          ) : (
            <Badge tone="amber">Verification {org.verificationStatus}</Badge>
          )
        }
      />

      {!verified ? (
        <div className="mb-5">
          <Alert tone="amber" title="Facility verification pending">
            Uploads are possible against consented patients, but the platform badge shows once a
            reviewer approves the facility.
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="People" title={`Staff (${staff.length})`} />
          <ul className="divide-y divide-line">
            {staff.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <p className="text-sm text-ink">{s.name}</p>
                <div className="flex items-center gap-2">
                  <Badge>{s.role.replace(/_/g, " ")}</Badge>
                  {s.verificationStatus === "verified" ? <span className="seal">✓</span> : null}
                </div>
              </li>
            ))}
            {!staff.length ? <li className="px-5 py-4 text-sm text-ink-faint">No staff attached yet.</li> : null}
          </ul>
        </Card>

        <Card>
          <CardHeader eyebrow="Records" title={`Recent uploads (${recentDocs.length})`} />
          <ul className="divide-y divide-line">
            {recentDocs.map((d) => {
              const status = effectiveStatus(d);
              return (
                <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{d.title}</p>
                    <p className="text-[11px] text-ink-faint">{formatDate(d.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {status === "done" ? (
                      <Badge tone="pine">extracted</Badge>
                    ) : status === "failed" ? (
                      <Badge tone="amber">extraction failed</Badge>
                    ) : (
                      <Badge>extracting…</Badge>
                    )}
                    {status === "failed" ? (
                      <OrgRetryButton documentId={d.id} patientId={d.patientId} />
                    ) : null}
                  </div>
                </li>
              );
            })}
            {!recentDocs.length ? (
              <li className="px-5 py-4 text-sm text-ink-faint">No uploads yet.</li>
            ) : null}
          </ul>
        </Card>

        <OrgUploadSection
          patients={consentedPatients.map((p) => ({ id: p.id, fullName: p.fullName }))}
        />

        {consentedPatients.length ? (
          <Card>
            <CardHeader eyebrow="Consent registry" title={`Patients granting this facility document consent (${consentedPatients.length})`} />
            <ul className="divide-y divide-line">
              {consentedPatients.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <p className="text-sm text-ink">{p.fullName}</p>
                  <p className="text-[11px] text-ink-faint">
                    consent valid to {formatDate(p.expiresAt, "short")}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
