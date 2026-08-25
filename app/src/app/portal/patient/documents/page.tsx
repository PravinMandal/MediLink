export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { FileClock, ShieldCheck } from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { patientService } from "@/server/modules/patients/service";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Documents",
  description: "Your source documents — the originals behind every record entry.",
};

const STATUS_META: Record<string, { label: string; tone: "pine" | "amber" | "alert" | "neutral" | "info" }> = {
  done: { label: "Processed", tone: "pine" },
  pending: { label: "Processing", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  failed: { label: "Extraction failed", tone: "alert" },
};

/**
 * Patient Documents (§7.7): a dedicated documents surface. The health-record
 * hub embeds this list too; this page is the sidebar destination.
 */
export default async function PatientDocumentsPage() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const docs = await db
    .select({
      id: documents.id,
      kind: documents.kind,
      title: documents.title,
      mimeType: documents.mimeType,
      pageCount: documents.pageCount,
      extractionStatus: documents.extractionStatus,
      recordedDate: documents.recordedDate,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.patientId, patient.id))
    .orderBy(desc(documents.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader
        eyebrow="Record"
        title="Documents"
        description="Originals are stored unchanged and never replaced. Extracted fields stay marked until a professional verifies them."
        action={
          <Link
            href="/portal/patient/record?tab=documents"
            className="glass-hover inline-flex items-center gap-2 rounded-xl border border-line-strong bg-paper-raised px-4 py-2.5 text-sm font-semibold text-ink"
          >
            View in health record
          </Link>
        }
      />

      {docs.length === 0 ? (
        <Card>
          <EmptyState
            title="No documents yet"
            body="Verified clinics and labs add your reports here. Each one keeps its original file, its hash, and its processing state."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            eyebrow={`${docs.length} document${docs.length > 1 ? "s" : ""}`}
            title="All source documents"
          />
          <ul className="divide-y divide-line">
            {docs.map((d) => {
              const status = STATUS_META[d.extractionStatus] ?? {
                label: d.extractionStatus,
                tone: "neutral" as const,
              };
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-paper-sunk text-[10px] font-bold uppercase text-pine"
                  >
                    {(d.mimeType.split("/")[1] ?? "file").slice(0, 4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{d.title}</p>
                    <p className="num mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-faint">
                      <FileClock size={12} aria-hidden />
                      {formatDate(d.recordedDate ?? d.createdAt)}
                      {d.pageCount ? ` · ${d.pageCount} pages` : ""}
                    </p>
                  </div>
                  <Badge tone={status.tone}>
                    {d.extractionStatus === "done" ? (
                      <ShieldCheck size={11} aria-hidden className="mr-0.5" />
                    ) : null}
                    {status.label}
                  </Badge>
                  <a
                    href={`/api/files/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-hover inline-flex h-9 shrink-0 items-center rounded-lg border border-line px-3 text-[12.5px] font-medium text-pine"
                  >
                    Open original
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
