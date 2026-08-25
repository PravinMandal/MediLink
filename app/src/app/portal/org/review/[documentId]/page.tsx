export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Card, CardHeader, Badge, Alert } from "@/components/ui";
import {
  CandidateFieldsTable,
  AttestationForms,
} from "@/components/lab-review";
import { requireUser } from "@/server/session";
import { listReviewQueueAction, reviewCandidatesAction } from "@/server/actions/lab-actions";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Verify lab report",
  description: "Compare extracted fields against the original report before attesting.",
};

/**
 * Lab verification view (BuildPlan §7.11): left = original document preview
 * (served by /api/files/[documentId], which enforces access), right =
 * extracted candidate fields, footer = explicit per-document attestation.
 */
export default async function ReviewDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const user = await requireUser();

  if (user.role !== "lab_staff" && user.role !== "org_admin") notFound();

  const fd = new FormData();
  fd.set("documentId", documentId);
  const result = await reviewCandidatesAction(fd);
  if (!result.ok) notFound();

  const { document: doc, candidates } = result;
  const pending = candidates.filter((c) => c.reviewState !== "attested").length;

  // Context strip: which queue position this document holds (cheap: the
  // queue list is already org-scoped to extraction-done lab reports).
  const queue = await listReviewQueueAction();
  const position = queue.findIndex((q) => q.documentId === documentId) + 1;

  return (
    <>
      <PageHeader
        eyebrow="Facility console · Work queue"
        title={`Verify: ${doc.title}`}
        description={`${doc.patientName}${doc.recordedDate ? ` · report dated ${formatDate(doc.recordedDate)}` : ""}`}
        action={
          pending > 0 ? (
            <Badge tone="amber">Needs review</Badge>
          ) : (
            <Badge tone="info">Attested</Badge>
          )
        }
      />

      {position > 0 ? (
        <p className="mb-4 text-[12px] text-ink-faint">
          Queue item <span className="num">{position}</span> of{" "}
          <span className="num">{queue.length}</span> ·{" "}
          <span className="num">{pending}</span> of{" "}
          <span className="num">{candidates.length}</span> fields awaiting attestation
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[55fr_45fr]">
        {/* Left: original document */}
        <Card className="flex min-h-[480px] flex-col">
          <CardHeader
            eyebrow="Original report"
            title="Source document"
            action={
              <a
                href={`/api/files/${documentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-pine underline decoration-pine/40 underline-offset-2 hover:decoration-pine"
              >
                Open in new tab ↗
              </a>
            }
          />
          <div className="flex-1 p-4 sm:p-5">
            <iframe
                src={`/api/files/${documentId}`}
                title={`Original document: ${doc.title}`}
                className="h-[520px] w-full rounded-lg border border-line bg-paper-sunk"
              />
          </div>
        </Card>

        {/* Right: candidate fields + attestation */}
        <div className="space-y-5">
          {doc.extractionError === "structured_data_unavailable" ? (
            <Alert tone="amber" title="Unable to verify — rely on the original">
              This report was marked structured_data_unavailable. The extracted fields are
              not endorsed; deliver and read the original document instead.
            </Alert>
          ) : null}

          <Card>
            <CardHeader
              eyebrow="Extracted candidates"
              title={`Fields (${candidates.length})`}
            />
            {candidates.length ? (
              <CandidateFieldsTable candidates={candidates} />
            ) : (
              <div className="px-4 py-4 text-sm text-ink-faint sm:px-5">
                No extracted fields for this document. If the source quality is too poor
                to verify, use “Mark unable to verify” to deliver the original.
              </div>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Decision" title="Attest this report" />
            <div className="px-4 py-4 sm:px-5">
              {pending > 0 ? (
                <AttestationForms documentId={documentId} />
              ) : candidates.length ? (
                <div className="space-y-3">
                  <p className="text-[13px] text-ink-soft">
                    Every extracted field from this document has been attested and
                    delivered.
                  </p>
                  <a
                    href="/portal/org"
                    className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-paper-raised px-4 text-sm font-medium text-ink transition-colors hover:border-ink-faint"
                  >
                    ← Back to the work queue
                  </a>
                </div>
              ) : (
                <AttestationForms documentId={documentId} />
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
