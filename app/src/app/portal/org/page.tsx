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
import { PageHeader, Card, CardHeader, Badge, Alert, EmptyState } from "@/components/ui";
import { db } from "@/server/db";
import { documents, organizations, user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { OrgUploadSection } from "@/components/org-upload";
import { VerificationQueue } from "@/components/lab-review";
import { listReviewQueueAction } from "@/server/actions/lab-actions";
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

  // P1: staff directory, consented-patient names, and upload titles below are
  // privileged — any authenticated account carrying an organizationId (a
  // doctor, or a patient attached via join) must not see them. The queries
  // run only for facility roles.
  if (user.role !== "lab_staff" && user.role !== "org_admin") {
    return (
      <>
        <PageHeader eyebrow="Facility console" title="Restricted area" />
        <Card className="mt-5">
          <div className="px-4 py-4 text-sm text-ink-soft sm:px-5">
            The facility console is restricted to lab staff and facility admins.
          </div>
        </Card>
      </>
    );
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.organizationId));

  if (!org) {
    return (
      <>
        <PageHeader eyebrow="Facility console" title="Facility not found" />
        <Alert tone="info" title="Facility record missing">
          Your account references a facility that no longer exists. Ask a platform admin to
          re-attach your account.
        </Alert>
      </>
    );
  }

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
      .limit(20),
  ]);

  const verified = org.verificationStatus === "verified";

  // §6.3: the work queue (verification) is the facility's primary landing
  // content. No-op for non lab_staff/org_admin users (action returns []).
  const reviewQueue =
    user.role === "lab_staff" || user.role === "org_admin"
      ? await listReviewQueueAction()
      : [];

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

      {user.role === "lab_staff" || user.role === "org_admin" ? (
        <div className="mb-5">
          <VerificationQueue
            items={reviewQueue.map((q) => ({
              documentId: q.documentId,
              patientName: q.patientName,
              title: q.title,
              recordedDate: q.recordedDate,
              fieldCount: q.fieldCount,
            }))}
          />
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
            {!staff.length ? (
              <li className="px-5 py-4">
                <EmptyState title="No staff attached yet" body="Facility accounts appear here once the platform admin links them to this organisation." />
              </li>
            ) : null}
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
              <li className="px-5 py-4">
                <EmptyState title="No uploads yet" body="Upload a patient's report from the upload panel above — originals are preserved unchanged." />
              </li>
            ) : null}
          </ul>
        </Card>

        <div id="upload" className="scroll-mt-24">
          <OrgUploadSection
            patients={consentedPatients.map((p) => ({ id: p.id, fullName: p.fullName }))}
          />
        </div>

        <Card>
          <CardHeader eyebrow="Consent registry" title={`Patients granting this facility document consent (${consentedPatients.length})`} />
          {consentedPatients.length ? (
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
          ) : (
            <div className="p-5">
              <EmptyState
                title="No document-consented patients yet"
                body="Patients appear here after they grant this facility the Source documents scope — that consent is what permits uploads."
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
