import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, documentScanState } from "@/server/db/schema";
import { getSessionUser } from "@/server/session";
import { policy } from "@/server/modules/access/policy";
import { audit } from "@/server/modules/audit/service";
import { rateLimit, LIMITS } from "@/server/modules/security/rate-limit";
import { readDocumentBytes, documentSignedUrl } from "@/server/modules/documents/pipeline";

/**
 * Authenticated document streaming. A FRESH policy decision happens on EVERY
 * read (BuildPlan §10.2 #5): patient self, consent grant with document
 * scope, or active break-glass. Infected files — and, whenever a malware
 * scanner is configured, not-yet-clean files — are quarantined.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  // Abuse control: bound download/open attempts per user (Backlog C).
  if (!rateLimit(`file:${user.id}`, LIMITS.fileDownload)) {
    return new NextResponse("Too many requests. Wait a minute and try again.", { status: 429 });
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));
  // Uniform 404 for missing-or-denied: no existence oracle for enumeration.
  if (!doc) return new NextResponse("Not found", { status: 404 });

  // Policy decision (logged to access_policy_evaluations).
  const decision = await policy.evaluate(
    {
      actorId: user.id,
      role: user.role,
      organizationId: user.organizationId,
      purpose: "document_view",
    },
    doc.patientId,
    ["documents"],
    "document.read",
  );
  if (decision.decision !== "allow") return new NextResponse("Not found", { status: 404 });

  // Quarantine policy (§9.4): an infected file is never served; while a
  // scanner is configured, unscanned uploads stay blocked until it reports
  // clean ("skipped" = deployment runs without a scanner).
  const [scan] = await db
    .select({ scanStatus: documentScanState.scanStatus })
    .from(documentScanState)
    .where(eq(documentScanState.documentId, doc.id));
  const scannerConfigured = Boolean(process.env.MALWARE_SCANNER);
  if (
    scan?.scanStatus === "infected" ||
    (scannerConfigured && (!scan || scan.scanStatus !== "clean"))
  ) {
    return new NextResponse("This file was quarantined by malware scanning.", { status: 410 });
  }

  // Mime allowlist: only formats we deliberately serve. Anything stored
  // outside it (e.g. a hand-edited row) is refused rather than sniffed.
  const isAllowedMime =
    doc.mimeType === "application/pdf" ||
    doc.mimeType.startsWith("image/") ||
    doc.mimeType === "text/plain";
  if (!isAllowedMime) return new NextResponse("Unsupported media type", { status: 415 });

  // Inline only for types that render safely with nosniff (PDF preview for
  // doctors); everything else downloads as an attachment.
  const inlineOk = doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/");

  await audit.record({
    actorId: user.id,
    actorRole: user.role,
    patientId: doc.patientId,
    action: "document.viewed",
    resourceType: "document",
    resourceId: doc.id,
    metadata: { via: decision.basisType, basisId: decision.basisId },
  });

  // Emergency basis: every read under an emergency event is separately
  // traceable (BuildPlan §7.12).
  if (decision.basisType === "emergency" && decision.basisId) {
    const { emergencyReadEvents } = await import("@/server/db/schema");
    await db.insert(emergencyReadEvents).values({
      emergencyEventId: decision.basisId,
      actorId: user.id,
      action: "document.viewed",
      resourceType: "document",
      resourceId: doc.id,
    });
  }

  // Prefer a short-lived signed redirect when the storage adapter supports it
  // (Supabase in production) — bytes bypass the function entirely. Local
  // storage falls through to streaming.
  const signed = await documentSignedUrl(doc.storageKey).catch(() => null);
  if (signed) {
    const res = NextResponse.redirect(signed, 302);
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const bytes = await readDocumentBytes(doc.storageKey);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${inlineOk ? "inline" : "attachment"}; filename="${doc.title.replace(/[^\w .-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
