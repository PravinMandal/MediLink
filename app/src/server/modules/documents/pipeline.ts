/**
 * Document ingest pipeline.
 *
 * upload → hash → store bytes → text extraction (PDF text layer, or plain
 * text passthrough for .txt; OCR/LLM extraction layers on top in the AI
 * module) → chunk & index for patient-scoped search.
 *
 * Runs inline today; the same step functions can be moved onto a durable
 * queue (Inngest) in production without touching callers.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, searchChunks } from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { contentHash, getStorage } from "./storage";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export class IngestError extends Error {}

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
      return { text: (Array.isArray(text) ? text.join("\n") : text).trim(), pageCount: totalPages ?? null };
    } catch {
      // Scanned PDF with no text layer — the AI/OCR layer handles it later.
      return { text: "", pageCount: null };
    }
  }
  // Images: text extraction happens in the AI/OCR layer.
  return { text: "", pageCount: null };
}

export async function ingestDocument(input: {
  patientId: string;
  uploadedById: string;
  organizationId?: string | null;
  kind: (typeof documents.$inferSelect)["kind"];
  title: string;
  mimeType: string;
  bytes: Uint8Array;
  recordedDate?: string;
  encounterId?: string | null;
}) {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new IngestError(`Unsupported file type: ${input.mimeType}`);
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new IngestError("File exceeds 20 MB limit");
  }

  const hash = contentHash(input.bytes);
  const id = crypto.randomUUID();
  const storageKey = `${input.patientId}/${id}`;
  const storage = getStorage();
  await storage.put(storageKey, input.bytes, input.mimeType);

  const [doc] = await db
    .insert(documents)
    .values({
      id,
      patientId: input.patientId,
      kind: input.kind,
      title: input.title,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      storageKey,
      contentHash: hash,
      extractionStatus: "processing",
      uploadedById: input.uploadedById,
      organizationId: input.organizationId ?? null,
      recordedDate: input.recordedDate ?? null,
      encounterId: input.encounterId ?? null,
    })
    .returning();

  await audit.record({
    actorId: input.uploadedById,
    patientId: input.patientId,
    organizationId: input.organizationId ?? null,
    action: "document.uploaded",
    resourceType: "document",
    resourceId: doc.id,
    metadata: { title: input.title, kind: input.kind, hash, size: input.bytes.byteLength },
  });

  // Extraction + indexing (inline; safe to retry)
  try {
    const { text, pageCount } = await extractText(input.bytes, input.mimeType);
    await db
      .update(documents)
      .set({ textExtract: text, pageCount, extractionStatus: "done" })
      .where(eq(documents.id, doc.id));
    if (text) {
      await indexDocumentChunks(doc.id, input.patientId, input.title, text, input.recordedDate);
    }
  } catch (err) {
    await db
      .update(documents)
      .set({ extractionStatus: "failed", extractionError: String(err) })
      .where(eq(documents.id, doc.id));
  }

  const [fresh] = await db.select().from(documents).where(eq(documents.id, doc.id));
  return fresh;
}

/** Chunk text (~1200 chars, sentence-aware-ish) and index for search. */
export async function indexDocumentChunks(
  documentId: string,
  patientId: string,
  title: string,
  text: string,
  date?: string | null,
) {
  // Replace any prior chunks for this document (idempotent re-index)
  await db.delete(searchChunks).where(eq(searchChunks.documentId, documentId));

  const cleaned = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return;

  const CHUNK = 1200;
  const chunks: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    let end = Math.min(i + CHUNK, cleaned.length);
    if (end < cleaned.length) {
      const dot = cleaned.lastIndexOf(". ", end);
      if (dot > i + CHUNK / 2) end = dot + 1;
    }
    chunks.push(cleaned.slice(i, end).trim());
    i = end;
  }

  if (!chunks.length) return;
  await db.insert(searchChunks).values(
    chunks.map((content) => ({
      patientId,
      documentId,
      recordType: "document",
      recordId: documentId,
      label: title,
      date: date ?? null,
      trust: "verified",
      content: `${title}\n${content}`,
    })),
  );
}

export async function reindexDocument(documentId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc?.textExtract) return;
  await indexDocumentChunks(
    doc.id,
    doc.patientId,
    doc.title,
    doc.textExtract,
    doc.recordedDate,
  );
}

export async function readDocumentBytes(storageKey: string): Promise<Uint8Array> {
  return getStorage().get(storageKey);
}
