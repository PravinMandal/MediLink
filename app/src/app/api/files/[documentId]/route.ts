import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getSessionUser } from "@/server/session";
import { access } from "@/server/modules/access/guard";
import { audit } from "@/server/modules/audit/service";
import { readDocumentBytes, documentSignedUrl } from "@/server/modules/documents/pipeline";

/**
 * Authenticated document streaming. Access check happens on EVERY read:
 * patient self, consent grant with document scope, or active break-glass.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId));
  // Uniform 404 for missing-or-denied: no existence oracle for enumeration.
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const decision = await access.check(
    { id: user.id, role: user.role, organizationId: user.organizationId },
    doc.patientId,
    "documents",
  );
  if (!decision.allowed) return new NextResponse("Not found", { status: 404 });

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
    metadata: { via: decision.via },
  });

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
