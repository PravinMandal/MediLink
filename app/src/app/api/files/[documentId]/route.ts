import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getSessionUser } from "@/server/session";
import { access } from "@/server/modules/access/guard";
import { audit } from "@/server/modules/audit/service";
import { readDocumentBytes } from "@/server/modules/documents/pipeline";

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
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const decision = await access.check(
    { id: user.id, role: user.role, organizationId: user.organizationId },
    doc.patientId,
    "documents",
  );
  if (!decision.allowed) return new NextResponse("Forbidden", { status: 403 });

  const bytes = await readDocumentBytes(doc.storageKey);
  await audit.record({
    actorId: user.id,
    actorRole: user.role,
    patientId: doc.patientId,
    action: "document.viewed",
    resourceType: "document",
    resourceId: doc.id,
    metadata: { via: decision.via },
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.title.replace(/[^\w .-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
