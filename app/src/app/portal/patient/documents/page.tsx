export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { records } from "@/server/modules/records/service";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents" };

export default async function PatientDocuments() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const docs = await records.documentsFor(patient.id);
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Source documents"
        description="Original reports exactly as uploaded by verified facilities. Their hash is on record — tampering is detectable."
      />
      {docs.length === 0 ? (
        <EmptyState title="No documents yet" body="Labs and doctors you visit will file reports here." />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{d.title}</p>
                    <Badge>{d.kind.replace(/_/g, " ")}</Badge>
                    {d.extractionStatus === "done" ? <Badge tone="pine">structured ✓</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {formatDate(d.recordedDate ?? d.createdAt)}
                    {d.organizationId ? ` · ${orgName.get(d.organizationId) ?? "Facility"}` : ""}
                    {" · "}
                    <span className="num" title="SHA-256 content hash">{d.contentHash.slice(0, 10)}…</span>
                  </p>
                </div>
                <a
                  href={`/api/files/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-line-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink-faint"
                >
                  Open ↗
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
