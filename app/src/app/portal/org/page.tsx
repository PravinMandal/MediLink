export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PageHeader, Card, CardHeader, Badge, Alert, EmptyState } from "@/components/ui";
import { db } from "@/server/db";
import { documents, organizations, patients, user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { UploadDocumentForm } from "@/components/doctor-forms";
import { desc, eq as eqOp } from "drizzle-orm";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Facility console" };

export default async function OrgConsole() {
  const user = await requireUser();

  if (!user.organizationId) {
    return (
      <>
        <PageHeader eyebrow="Facility console" title="No facility attached" />
        <Alert tone="info" title="Attach your facility">
          Your account isn&apos;t linked to an organization yet. An existing facility admin can
          attach you, or a platform admin creates your facility.
        </Alert>
      </>
    );
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.organizationId));

  const [staff, orgPatients, recentDocs] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name, role: userTable.role, verificationStatus: userTable.verificationStatus })
      .from(userTable)
      .where(eqOp(userTable.organizationId, org.id)),
    db
      .select({ id: patients.id, fullName: patients.fullName, createdAt: patients.createdAt })
      .from(patients)
      .where(eqOp(patients.organizationId, org.id))
      .orderBy(desc(patients.createdAt))
      .limit(10),
    db
      .select()
      .from(documents)
      .where(eqOp(documents.organizationId, org.id))
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
            {recentDocs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{d.title}</p>
                  <p className="text-[11px] text-ink-faint">{formatDate(d.createdAt)}</p>
                </div>
                {d.extractionStatus === "done" ? <Badge tone="pine">extracted</Badge> : <Badge>{d.extractionStatus}</Badge>}
              </li>
            ))}
            {!recentDocs.length ? (
              <li className="px-5 py-4 text-sm text-ink-faint">No uploads yet.</li>
            ) : null}
          </ul>
        </Card>

        {orgPatients.length ? (
          <Card>
            <CardHeader eyebrow="Registry" title={`Patients registered by this facility (${orgPatients.length})`} />
            <ul className="divide-y divide-line">
              {orgPatients.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                  <p className="text-sm text-ink">{p.fullName}</p>
                  <p className="text-[11px] text-ink-faint">{formatDate(p.createdAt, "short")}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
