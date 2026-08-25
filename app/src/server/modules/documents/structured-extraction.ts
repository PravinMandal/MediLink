/**
 * Structured extraction as a durable job (BuildPlan §9.4).
 *
 * Text → structured candidates (LLM) → observation/diagnostic-report writes.
 * Runs through `job_runs` with an idempotency key per document so the
 * request-path kick and the scheduled worker never double-write. Extraction
 * output is machine-read from document text — displayed with
 * trust:"extracted", never outranking lab-verified values.
 */
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { extraction } from "@/server/modules/ai/extract";
import { records } from "@/server/modules/records/service";

export const STRUCTURED_EXTRACTION_JOB = "documents.structured_extraction";

export function structuredExtractionKey(documentId: string): string {
  return `${STRUCTURED_EXTRACTION_JOB}:${documentId}`;
}

export async function runStructuredExtraction(
  documentId: string,
  ctx: {
    patientId: string;
    userId: string;
    organizationId: string | null;
    title: string;
    kind: string;
    recordedDate?: string;
  },
): Promise<Record<string, unknown>> {
  const [doc] = await db
    .select({ textExtract: documents.textExtract })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!doc?.textExtract) return { skipped: "no extracted text" };

  const extracted = await extraction.fromText(doc.textExtract);
  if (extracted.labs.length || extracted.bloodGroup) {
    const prov = {
      authoredById: ctx.userId,
      organizationId: ctx.organizationId,
      sourceDocumentId: documentId,
      // Extraction output is machine-read from document text — displayed,
      // but never outranking a lab-verified value.
      trust: "extracted" as const,
    };
    await records.addObservations(
      ctx.patientId,
      extracted.labs.map((l) => ({
        panel: l.panel,
        name: l.name,
        value: l.value ?? null,
        valueString: l.valueString ?? null,
        unit: l.unit ?? undefined,
        referenceRangeLow: l.referenceRangeLow ?? null,
        referenceRangeHigh: l.referenceRangeHigh ?? null,
        flag: l.flag,
        effectiveDate: ctx.recordedDate,
      })),
      prov,
    );
    if (extracted.bloodGroup) {
      await records.addObservation(
        ctx.patientId,
        {
          panel: "Blood Group",
          name: "Blood Group",
          valueString: extracted.bloodGroup,
          effectiveDate: ctx.recordedDate,
          flag: "normal" as const,
        },
        prov,
      );
    }
  }
  if (ctx.kind === "lab_report") {
    await records.addDiagnosticReport(
      ctx.patientId,
      {
        title: ctx.title,
        category: "lab",
        conclusion: extracted.reportTitle ?? undefined,
        effectiveDate: ctx.recordedDate,
      },
      {
        authoredById: ctx.userId,
        organizationId: ctx.organizationId,
        sourceDocumentId: documentId,
        trust: "extracted" as const,
      },
    );
  }
  return {
    labs: extracted.labs.length,
    bloodGroup: Boolean(extracted.bloodGroup),
  };
}
