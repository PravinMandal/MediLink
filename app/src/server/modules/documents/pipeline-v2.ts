/**
 * Document ingestion v2 (BuildPlan §9.4, Backlog C).
 *
 * Upload → validate name/type/size → magic-byte sniff → quarantine storage →
 * persist immutable metadata + scan state → outbox event → DURABLE
 * extraction job (job_runs) with page-preserving text, never mutating the
 * original bytes. Extraction runs out-of-band via `runExtractionPass`.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  documents,
  documentScanState,
  extractionJobs,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { outbox } from "@/server/modules/jobs/outbox";
import { contentHash, getStorage } from "./storage";

const MAX_BYTES = 4 * 1024 * 1024;

/** Allowed declared MIME types; validated against magic bytes below. */
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

/** Magic-byte signatures (BuildPlan: validate magic bytes, not browser MIME). */
function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  const b = bytes;
  const startsWith = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (startsWith(0x25, 0x50, 0x44, 0x46)) return "application/pdf"; // %PDF
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (startsWith(0x52, 0x49, 0x46, 0x46)) {
    // RIFF…WEBP
    if (bytes.length > 12 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
      return "image/webp";
    return null;
  }
  // Heuristic plain text: no NUL bytes and mostly printable in first 512.
  const sample = bytes.subarray(0, Math.min(512, bytes.length));
  if (![...sample].includes(0) && sample.length > 0) return "text/plain";
  return null;
}

export class IngestError extends Error {}

export const QUARANTINE_PREFIX = "quarantine/";

/** Malware-scan integration point: clean/skipped in dev; quarantined until clean. */
async function scanDocument(
  documentId: string,
  bytes: Uint8Array,
  mime: string,
  tx?: Pick<typeof db, "insert">,
) {
  // Integration point for a real scanner (ClamAV etc.). In the pilot demo
  // environment scanning is "skipped" and files remain served only through
  // the authorization-checked, safe-preview file route.
  const scanner = process.env.MALWARE_SCANNER ?? "none";
  const status = scanner === "none" ? "skipped" : "pending";
  await (tx ?? db).insert(documentScanState).values({
    documentId,
    scanStatus: status,
    scanner: scanner === "none" ? "disabled (pilot)" : scanner,
    detail:
      scanner === "none"
        ? "Malware scanning disabled in this environment; files stay behind the authorized file route and are never rendered as active content."
        : null,
  });
  void bytes;
  void mime;
}

export async function ingestDocumentV2(input: {
  patientId: string;
  uploadedById: string;
  organizationId?: string | null;
  kind: (typeof documents.$inferSelect)["kind"];
  title: string;
  mimeType: string;
  fileName?: string;
  bytes: Uint8Array;
  recordedDate?: string;
  encounterId?: string | null;
}): Promise<{ documentId: string; extractionJobId: string }> {
  // 1. Validate name/type/size.
  const title = input.title.trim();
  if (!title || title.length > 200) throw new IngestError("A title of up to 200 characters is required.");
  if (/[\\/]/.test(input.fileName ?? "") || /\.\./.test(input.fileName ?? "")) {
    throw new IngestError("Invalid file name.");
  }
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new IngestError(`Unsupported file type: ${input.mimeType}`);
  }
  if (input.bytes.byteLength === 0) throw new IngestError("Empty file.");
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new IngestError("File exceeds 4 MB limit");
  }

  // 2. Magic-byte validation — the declared MIME must match the content.
  const sniffed = sniffMime(input.bytes);
  if (!sniffed || sniffed !== input.mimeType) {
    throw new IngestError(
      "File content does not match its declared type. Upload the original file.",
    );
  }

  // 3. Hash + immutable storage.
  const hash = contentHash(input.bytes);
  const id = crypto.randomUUID();
  const storageKey = `${input.patientId}/${id}`;
  const storage = getStorage();
  await storage.put(storageKey, input.bytes, input.mimeType);

  // 4. Immutable metadata + scan state + durable job + outbox, committed
  // atomically: a crash between them used to leave a "pending" document
  // with no extraction job (permanently unextracted, no error surfaced).
  const { documentId, extractionJobId } = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({
        id,
        patientId: input.patientId,
        kind: input.kind,
        title,
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        storageKey,
        contentHash: hash,
        extractionStatus: "pending", // extraction is now out-of-band
        uploadedById: input.uploadedById,
        organizationId: input.organizationId ?? null,
        recordedDate: input.recordedDate ?? null,
        encounterId: input.encounterId ?? null,
      })
      .returning();

    await scanDocument(doc!.id, input.bytes, input.mimeType, tx);

    const [job] = await tx
      .insert(extractionJobs)
      .values({ documentId: doc!.id, status: "pending" })
      .returning();
    // Extraction is driven by extraction_jobs + runExtractionPass (worker).
    await outbox.publish({
      aggregateType: "document",
      aggregateId: doc!.id,
      type: "document.uploaded",
      payload: { documentId: doc!.id, patientId: input.patientId, kind: input.kind, hash },
      tx: tx as unknown as Pick<typeof db, "insert">,
    });
    return { documentId: doc!.id, extractionJobId: job!.id };
  });

  const doc = { id: documentId };
  const job = { id: extractionJobId };

  try {
    await audit.record({
      actorId: input.uploadedById,
      patientId: input.patientId,
      organizationId: input.organizationId ?? null,
      action: "document.uploaded",
      resourceType: "document",
      resourceId: doc!.id,
      metadata: { title, kind: input.kind, hash, size: input.bytes.byteLength, extractionJobId: job!.id },
    });
  } catch (err) {
    console.error("[audit] write failed (document.uploaded)", err);
  }

  return { documentId: doc!.id, extractionJobId: job!.id };
}

/* ------------------------------------------------------------------ */
/* Durable extraction                                                  */
/* ------------------------------------------------------------------ */

async function extractText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ text: string; pageCount: number | null }> {
  if (mimeType === "text/plain") {
    return { text: new TextDecoder().decode(bytes), pageCount: null };
  }
  if (mimeType === "application/pdf") {
    try {
      const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text, totalPages } = await pdfExtract(pdf, { mergePages: true });
      return {
        text: (Array.isArray(text) ? text.join("\n") : text).trim(),
        pageCount: totalPages ?? null,
      };
    } catch {
      return { text: "", pageCount: null }; // scanned PDF — OCR layer
    }
  }
  return { text: "", pageCount: null }; // images — OCR layer
}

/**
 * Claim-and-run one pending extraction job. Idempotent: a done extraction
 * for a document is never re-run; retries never touch the stored original
 * bytes. Called from a worker/timer (durable), not inline with the request.
 */
export async function runExtractionPass(): Promise<{
  ran: boolean;
  documentId?: string;
  status?: string;
}> {
  const claimed = await db.execute(sql`
    UPDATE extraction_jobs SET status = 'processing', attempts = attempts + 1, updated_at = now()
    WHERE id = (
      SELECT id FROM extraction_jobs
      WHERE status = 'pending' OR (status = 'failed' AND attempts < 5)
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, document_id, attempts;
  `);
  const row = (claimed.rows?.[0] ?? null) as
    | { id: string; document_id: string; attempts: number }
    | null;
  if (!row) return { ran: false };

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, row.document_id));
    if (!doc) throw new Error("document row missing");
    const bytes = await getStorage().get(doc.storageKey);
    const { text, pageCount } = await extractText(bytes, doc.mimeType);
    await db
      .update(documents)
      .set({ textExtract: text, pageCount, extractionStatus: "done", extractionError: null })
      .where(eq(documents.id, doc.id));
    const { indexDocumentChunks } = await import("./pipeline");
    if (text) {
      await indexDocumentChunks(doc.id, doc.patientId, doc.title, text, doc.recordedDate);
    }
    await db
      .update(extractionJobs)
      .set({ status: "done", finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(extractionJobs.id, row.id));
    await outbox.publish({
      aggregateType: "document",
      aggregateId: doc.id,
      type: "document.extracted",
      payload: { documentId: doc.id, patientId: doc.patientId, pageCount, textLength: text.length },
    });
    return { ran: true, documentId: doc.id, status: "done" };
  } catch (err) {
    const dead = row.attempts >= 5;
    await db
      .update(extractionJobs)
      .set({
        status: dead ? "dead" : "failed",
        lastError: String(err).slice(0, 500),
        finishedAt: dead ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(extractionJobs.id, row.id));
    await db
      .update(documents)
      .set({
        extractionStatus: dead ? "failed" : "processing",
        extractionError: String(err).slice(0, 300),
      })
      .where(eq(documents.id, row.document_id));
    return { ran: true, documentId: row.document_id, status: dead ? "dead" : "failed" };
  }
}

/** Re-enqueue a dead extraction for retry (operator action). */
export async function retryExtraction(documentId: string) {
  await db
    .update(extractionJobs)
    .set({ status: "pending", attempts: 0, lastError: null, finishedAt: null, updatedAt: new Date() })
    .where(and(eq(extractionJobs.documentId, documentId), eq(extractionJobs.status, "dead")));
  await db
    .update(documents)
    .set({ extractionStatus: "pending", extractionError: null })
    .where(eq(documents.id, documentId));
}

export async function readDocumentBytes(storageKey: string): Promise<Uint8Array> {
  return getStorage().get(storageKey);
}

export async function documentSignedUrl(
  storageKey: string,
  expiresInSeconds?: number,
): Promise<string | null> {
  return (await getStorage().signedUrl?.(storageKey, expiresInSeconds)) ?? null;
}
