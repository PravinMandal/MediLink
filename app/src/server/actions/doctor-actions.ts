"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser, type SessionUser } from "@/server/session";
import { access, AccessDeniedError, EMERGENCY_SCOPES, scopeForResource } from "@/server/modules/access/guard";
import {
  submitPractitionerVerification,
  requireVerifiedPractitioner,
} from "@/server/modules/identity/verification";
import { records } from "@/server/modules/records/service";
import { ingestDocument } from "@/server/modules/documents/pipeline";
import { extraction } from "@/server/modules/ai/extract";
import { contradictionEngine } from "@/server/modules/ai/contradictions";
import { summarizer } from "@/server/modules/ai/summarize";
import { emergency } from "@/server/modules/emergency/service";
import { audit } from "@/server/modules/audit/service";
import type { FormState } from "./auth-actions";

function guardUser(user: SessionUser) {
  return {
    id: user.id,
    role: user.role,
    organizationId: user.organizationId,
  };
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export async function submitVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "doctor") return { error: "Only doctor accounts submit practitioner verification." };
  try {
    await submitPractitionerVerification({
      userId: user.id,
      fullName: String(formData.get("fullName") ?? "").trim(),
      registrationNumber: String(formData.get("registrationNumber") ?? "").trim(),
      council: String(formData.get("council") ?? "").trim() || undefined,
      qualification: String(formData.get("qualification") ?? "").trim() || undefined,
      specialty: String(formData.get("specialty") ?? "").trim() || undefined,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not submit verification. Check the fields and try again." };
  }
  revalidatePath("/portal/doctor");
  revalidatePath("/portal/doctor/verification");
  return { ok: "Verification submitted." };
}

/* ------------------------------------------------------------------ */
/* Clinical records                                                    */
/* ------------------------------------------------------------------ */

export async function addClinicalRecordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!patientId || !kind) return { error: "Missing patient or record type." };

  try {
    const practitioner = await requireVerifiedPractitioner(user.id);
    // Doctors write with consent for the scope governing that record kind —
    // same mapping as reads (scopeForResource), never blanket "conditions".
    const scope = scopeForResource(
      kind === "observation"
        ? "observations"
        : kind === "allergy"
          ? "allergies"
          : kind === "medication"
            ? "medication_statements"
            : kind === "procedure"
              ? "procedures"
              : "conditions",
    );
    await access.assert(guardUser(user), patientId, scope);

    const prov = {
      authoredById: user.id,
      organizationId: practitioner.organizationId,
      trust: "verified" as const,
    };

    switch (kind) {
      case "condition": {
        const name = String(formData.get("name") ?? "").trim();
        if (!name) return { error: "Condition name is required." };
        await records.addCondition(
          patientId,
          {
            name,
            status: (String(formData.get("status") ?? "active") as "active" | "chronic" | "resolved"),
            onsetDate: String(formData.get("onsetDate") ?? "") || undefined,
            notes: String(formData.get("notes") ?? "") || undefined,
          },
          prov,
        );
        break;
      }
      case "allergy": {
        const substance = String(formData.get("substance") ?? "").trim();
        if (!substance) return { error: "Allergy substance is required." };
        await records.addAllergy(
          patientId,
          {
            substance,
            criticality: String(formData.get("criticality") ?? "") || undefined,
            reaction: String(formData.get("reaction") ?? "") || undefined,
          },
          prov,
        );
        break;
      }
      case "medication": {
        const medication = String(formData.get("medication") ?? "").trim();
        if (!medication) return { error: "Medication name is required." };
        await records.addMedication(
          patientId,
          {
            medication,
            dose: String(formData.get("dose") ?? "") || undefined,
            frequency: String(formData.get("frequency") ?? "") || undefined,
            startDate: String(formData.get("startDate") ?? "") || undefined,
            prescriberId: practitioner.id,
          },
          prov,
        );
        break;
      }
      case "observation": {
        const name = String(formData.get("name") ?? "").trim();
        const rawValue = String(formData.get("value") ?? "").trim();
        if (!name) return { error: "Observation name is required." };
        const numeric = rawValue ? Number(rawValue.replace(/,/g, "")) : null;
        await records.addObservation(
          patientId,
          {
            name,
            panel: String(formData.get("panel") ?? "") || undefined,
            value: numeric != null && Number.isFinite(numeric) ? numeric : null,
            valueString: numeric == null ? rawValue || null : null,
            unit: String(formData.get("unit") ?? "") || undefined,
            effectiveDate: String(formData.get("effectiveDate") ?? "") || undefined,
          },
          prov,
        );
        break;
      }
      case "procedure": {
        const name = String(formData.get("name") ?? "").trim();
        if (!name) return { error: "Procedure name is required." };
        await records.addProcedure(
          patientId,
          {
            name,
            performedDate: String(formData.get("performedDate") ?? "") || undefined,
            outcome: String(formData.get("outcome") ?? "") || undefined,
          },
          prov,
        );
        break;
      }
      default:
        return { error: "Unknown record type." };
    }

    await contradictionEngine.detect(patientId);
  } catch (err) {
    if (err instanceof AccessDeniedError) return { error: "You don't have consent to write this record type." };
    if (err instanceof Error && err.message === "VERIFICATION_REQUIRED")
      return { error: "Your practitioner verification is still pending." };
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not save the record." };
  }

  revalidatePath(`/portal/doctor/patients/${patientId}`);
  return { ok: "Record added with your provenance." };
}

/* ------------------------------------------------------------------ */
/* Document upload (doctors + lab staff)                               */
/* ------------------------------------------------------------------ */

/** Retry a failed/stale extraction for one document (doctor/lab uploader). */
export async function retryExtractionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");

  // Consent + role: same gate as viewing documents for this patient.
  const decision = await access.check(
    { id: user.id, role: user.role, organizationId: user.organizationId },
    patientId,
    "documents",
  );
  if (!decision.allowed) return { error: "Documents consent required." };

  const { db } = await import("@/server/db");
  const { documents } = await import("@/server/db/schema");
  const { eq, and } = await import("drizzle-orm");
  // The document must belong to the consented patient (prevents extracting
  // another patient's document into this one's chart) and, for facility
  // roles, to the caller's own organization.
  const scope =
    user.role === "doctor"
      ? and(eq(documents.id, documentId), eq(documents.patientId, patientId))
      : and(
          eq(documents.id, documentId),
          eq(documents.patientId, patientId),
          eq(documents.organizationId, user.organizationId ?? ""),
        );
  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      kind: documents.kind,
      recordedDate: documents.recordedDate,
      status: documents.extractionStatus,
    })
    .from(documents)
    .where(scope);
  if (!doc) return { error: "Document not found." };
  // Throttle: never retry an extraction already in flight (also bounds LLM cost).
  if (doc.status === "processing") return { error: "Extraction is already running." };

  await db
    .update(documents)
    .set({ extractionStatus: "processing", extractionError: null })
    .where(eq(documents.id, documentId));

  try {
    await audit.record({
      actorId: user.id,
      actorRole: user.role,
      patientId,
      action: "document.extraction.retried",
      resourceType: "document",
      resourceId: documentId,
    });
  } catch (err) {
    console.error("[audit] write failed (document.extraction.retried)", err);
  }

  after(async () => {
    try {
      await runExtraction(documentId, {
        patientId,
        userId: user.id,
        organizationId: user.organizationId,
        title: doc.title,
        kind: doc.kind,
        recordedDate: doc.recordedDate ?? undefined,
      });
    } catch {
      await db
        .update(documents)
        .set({ extractionStatus: "failed" })
        .where(eq(documents.id, documentId))
        .catch(() => undefined);
    }
  });

  revalidatePath(`/portal/doctor/patients/${patientId}`);
  revalidatePath("/portal/org");
  return { ok: "Extraction retry started." };
}

export async function uploadDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "lab_report") as Parameters<
    typeof ingestDocument
  >[0]["kind"];
  const recordedDate = String(formData.get("recordedDate") ?? "") || undefined;

  if (!patientId) return { error: "Missing patient." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (!title) return { error: "Give the document a title." };

  try {
    if (user.role === "doctor") {
      await requireVerifiedPractitioner(user.id);
    } else if (user.role === "lab_staff" || user.role === "org_admin") {
      if (!user.organizationId) return { error: "Your account has no organization." };
    } else {
      return { error: "Only verified professionals can upload records." };
    }

    // Contributors need document-scope consent to attach to the record
    const decision = await access.check(guardUser(user), patientId, "documents");
    if (!decision.allowed) {
      return {
        error:
          "No active consent from this patient for document uploads. Ask the patient to grant access first.",
      };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await ingestDocument({
      patientId,
      uploadedById: user.id,
      organizationId: user.organizationId,
      kind,
      title,
      mimeType: file.type || "application/octet-stream",
      bytes,
      recordedDate,
    });

    // Structured extraction (PDF text + LLM + observation writes) runs
    // AFTER the response — it can take tens of seconds with an LLM and must
    // not block the action past serverless limits. The UI shows the
    // document's extractionStatus chip (pending → done/failed).
    if (doc) {
      after(async () => {
        try {
          await runExtraction(doc.id, {
            patientId,
            userId: user.id,
            organizationId: user.organizationId,
            title,
            kind: doc.kind,
            recordedDate,
          });
        } catch {
          const { db } = await import("@/server/db");
          const { documents } = await import("@/server/db/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(documents)
            .set({ extractionStatus: "failed" })
            .where(eq(documents.id, doc.id))
            .catch(() => undefined);
        }
        // M7: contradiction detection is post-processing — its failure must
        // never be attributed to extraction (which already succeeded).
        try {
          await contradictionEngine.detect(patientId);
        } catch (err) {
          console.error("[contradictions] post-upload detection failed", err);
        }
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("Unsupported")) return { error: message };
    if (message === "VERIFICATION_REQUIRED")
      return { error: "Your practitioner verification is still pending." };
    // Storage misconfiguration is the common deploy-time failure — surface
    // it distinctly instead of a generic retry message.
    if (message.includes("Supabase storage")) {
      console.error("[upload] storage adapter failed", message);
      return {
        error:
          "Document storage is not configured correctly on this deployment (Supabase credentials rejected). The administrator must fix SUPABASE_SERVICE_ROLE_KEY.",
      };
    }
    return { error: "Upload failed. Try again." };
  }

  revalidatePath(`/portal/doctor/patients/${patientId}`);
  revalidatePath("/portal/org");
  return { ok: "Document stored with provenance; extraction is running." };
}

/** Shared post-upload extraction: text → structured rows → diagnostic report. */
async function runExtraction(
  documentId: string,
  ctx: {
    patientId: string;
    userId: string;
    organizationId: string | null;
    title: string;
    kind: string;
    recordedDate?: string;
  },
) {
  const { db } = await import("@/server/db");
  const { documents } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");
  const [doc] = await db
    .select({ textExtract: documents.textExtract })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!doc?.textExtract) return;

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
}

/* ------------------------------------------------------------------ */
/* AI summary                                                          */
/* ------------------------------------------------------------------ */

export async function generateSummaryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  const question = String(formData.get("question") ?? "").trim() || undefined;
  if (!patientId) return { error: "Missing patient." };

  try {
    // "*" requires any active grant (or emergency); the decision's scopes
    // then constrain the summary so a partial grant never yields a
    // full-record SBAR.
    const decision = await access.assert(guardUser(user), patientId, "*");
    const granted =
      decision.via === "emergency"
        ? EMERGENCY_SCOPES
        : decision.scopes;
    await summarizer.generate({
      patientId,
      requestedById: user.id,
      question,
      scopes: decision.via === "self" ? null : granted,
    });
    await audit.record({
      actorId: user.id,
      actorRole: user.role,
      patientId,
      action: "ai.summary.generated",
      resourceType: "ai_summary",
      reason: question,
    });
  } catch (err) {
    if (err instanceof AccessDeniedError) return { error: "Access denied." };
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not generate the summary." };
  }

  revalidatePath(`/portal/doctor/patients/${patientId}`);
  return { ok: "Summary generated." };
}

/* ------------------------------------------------------------------ */
/* Emergency break-glass                                               */
/* ------------------------------------------------------------------ */

export async function breakGlassAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!patientId) return { error: "Missing patient." };

  try {
    const practitioner = await requireVerifiedPractitioner(user.id);
    await emergency.breakGlass({
      practitionerId: practitioner.id,
      practitionerUserId: user.id,
      organizationId: practitioner.organizationId,
      patientId,
      reason,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    if (err instanceof Error && err.message === "VERIFICATION_REQUIRED")
      return { error: "Only verified practitioners can use emergency access." };
    return { error: "A clinical reason of at least 10 characters is required." };
  }

  revalidatePath(`/portal/doctor/patients/${patientId}`);
  return { ok: "Break-glass active for 60 minutes. The patient has been notified." };
}
