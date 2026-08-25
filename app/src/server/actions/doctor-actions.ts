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
import { ingestDocumentV2, retryExtraction as retryExtractionV2 } from "@/server/modules/documents/pipeline-v2";
import { contradictionEngine } from "@/server/modules/ai/contradictions";
import { summarizer } from "@/server/modules/ai/summarize";
import { emergency } from "@/server/modules/emergency/service";
import { audit } from "@/server/modules/audit/service";
import { recordVersions } from "@/server/modules/records/versions";
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

  // Durable retry: reset the job; the worker (/api/worker) picks it up.
  await retryExtractionV2(documentId);

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

  // Kick a worker pass immediately (best-effort); the cron worker guarantees
  // eventual processing.
  after(async () => {
    const { runExtractionPass } = await import("@/server/modules/documents/pipeline-v2");
    try {
      for (let i = 0; i < 5; i++) {
        const pass = await runExtractionPass();
        if (!pass.ran || pass.status === "done") break;
      }
    } catch (err) {
      console.error("[retry] extraction pass failed", err);
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
    typeof ingestDocumentV2
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
    const { documentId } = await ingestDocumentV2({
      patientId,
      uploadedById: user.id,
      organizationId: user.organizationId,
      kind,
      title,
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
      bytes,
      recordedDate,
    });

    // Structured extraction (PDF text + LLM + observation writes) is a
    // durable job (extraction_jobs + job_runs): enqueued idempotently here,
    // processed by the kick below and by the cron worker (/api/worker) for
    // durability/retries.
    const { jobs } = await import("@/server/modules/jobs/outbox");
    await jobs.enqueue({
      jobType: "documents.structured_extraction",
      payload: {
        documentId,
        patientId,
        userId: user.id,
        organizationId: user.organizationId,
        title,
        kind,
        recordedDate,
      },
      idempotencyKey: `documents.structured_extraction:${documentId}`,
    });
    after(async () => {
      const { runExtractionPass } = await import("@/server/modules/documents/pipeline-v2");
      try {
        for (let i = 0; i < 5; i++) {
          const pass = await runExtractionPass();
          if (!pass.ran || pass.status === "done") break;
        }
      } catch (err) {
        console.error("[upload] post-upload extraction pass failed", err);
      }
      try {
        // Accelerator: run queued jobs now so the demo flow feels instant.
        // The handler is idempotent per document.
        const { jobs: jobRunner } = await import("@/server/modules/jobs/outbox");
        for (let i = 0; i < 3; i++) {
          const run = await jobRunner.runOnce();
          if (!run.ran) break;
        }
        await contradictionEngine.detect(patientId);
      } catch (err) {
        console.error("[upload] post-upload job pass failed", err);
      }
    });
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
  // Accept either a resolved patientId (record page) or a raw identifier
  // typed into the dedicated emergency page (§6.2 #3).
  let patientId = String(formData.get("patientId") ?? "");
  const identifier = String(formData.get("patientIdText") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const stepUpPassword = String(formData.get("stepUpPassword") ?? "");

  if (!patientId && identifier) {
    const { discovery } = await import("@/server/modules/identity/discovery");
    const lookup = await discovery.lookupIdentifier({
      actorId: user.id,
      identifier,
    });
    if (lookup.kind === "record_may_exist" || lookup.kind === "handoff") {
      patientId = lookup.patientId;
    } else if (lookup.kind === "rate_limited") {
      return { error: lookup.message };
    } else {
      // Uniform wording — no existence oracle during an emergency either.
      return {
        error:
          "No MediLink record is associated with this identifier. Proceed with local emergency protocols; the patient can also present their card.",
      };
    }
  }
  if (!patientId) return { error: "Enter the patient's ID or ABHA number." };

  // High-assurance policy: fresh step-up authentication required.
  const { confirmStepUp, hasFreshStepUp } = await import("@/server/session");
  if (!hasFreshStepUp(user.id)) {
    if (!stepUpPassword) {
      return {
        error:
          "Emergency access requires re-entering your password to confirm it is you. Enter your password and try again.",
      };
    }
    const ok = await confirmStepUp(user.id, stepUpPassword);
    if (!ok) return { error: "Password check failed. Try again." };
  }

  // Per-doctor abuse limit: at most 3 break-glass events per hour.
  const { rateLimit } = await import("@/server/modules/identity/discovery");
  if (!rateLimit(`breakglass:${user.id}`, { windowMs: 60 * 60 * 1000, max: 3 })) {
    return {
      error:
        "Emergency access limit reached for this hour. If this is a genuine emergency, contact MediLink support.",
    };
  }

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

/* ------------------------------------------------------------------ */
/* Record corrections (BuildPlan §7.10, Backlog D)                     */
/* ------------------------------------------------------------------ */

const CORRECTABLE: Record<
  string,
  "condition" | "allergy" | "medication_statement"
> = {
  condition: "condition",
  allergy: "allergy",
  medication_statement: "medication_statement",
};

/**
 * Correct a clinical record (§7.10): the contributor never edits the
 * original. This (a) inserts the corrected row with verified trust, (b)
 * supersedes the original via records.supersede, and (c) seals the new
 * version via recordVersions.seal with replacesVersionId when the original
 * has a sealed version. A mandatory correction reason is stored with the
 * version chain.
 */
export async function correctRecordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientId = String(formData.get("patientId") ?? "");
  const originalTypeRaw = String(formData.get("originalType") ?? "");
  const originalId = String(formData.get("originalId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!patientId || !originalId) return { error: "Missing record to correct." };
  const originalType = CORRECTABLE[originalTypeRaw];
  if (!originalType) return { error: "This record type cannot be corrected here." };
  if (reason.length < 10)
    return { error: "A correction reason of at least 10 characters is required." };

  try {
    const practitioner = await requireVerifiedPractitioner(user.id);
    // Write requires consent for the scope governing this record kind.
    const scope = scopeForResource(
      originalType === "condition"
        ? "conditions"
        : originalType === "allergy"
          ? "allergies"
          : "medication_statements",
    );
    await access.assert(guardUser(user), patientId, scope);

    const prov = {
      authoredById: user.id,
      organizationId: practitioner.organizationId,
      // A correction by a verified practitioner carries the same trust as a
      // direct entry; provenance of the original stays intact on its own row.
      trust: "verified" as const,
    };

    // The original row supplies the source-document linkage when present.
    const { db } = await import("@/server/db");
    const { conditions, allergies, medicationStatements } = await import(
      "@/server/db/schema"
    );
    const { eq } = await import("drizzle-orm");
    const table =
      originalType === "condition"
        ? conditions
        : originalType === "allergy"
          ? allergies
          : medicationStatements;
    const [original] = await db.select().from(table).where(eq(table.id, originalId));
    if (!original || original.patientId !== patientId)
      return { error: "Original record not found for this patient." };

    let newId: string;
    let payload: Record<string, unknown>;

    if (originalType === "condition") {
      const name = String(formData.get("name") ?? "").trim();
      if (!name) return { error: "Condition name is required." };
      const row = await records.addCondition(
        patientId,
        {
          name,
          status: String(formData.get("status") ?? "active") as
            | "active"
            | "resolved"
            | "chronic",
          onsetDate: String(formData.get("onsetDate") ?? "") || undefined,
          notes: String(formData.get("notes") ?? "") || undefined,
        },
        { ...prov, sourceDocumentId: original.sourceDocumentId ?? null },
      );
      newId = row.id;
      payload = { name, status: row.status, onsetDate: row.onsetDate, notes: row.notes };
    } else if (originalType === "allergy") {
      const substance = String(formData.get("substance") ?? "").trim();
      if (!substance) return { error: "Allergy substance is required." };
      const row = await records.addAllergy(
        patientId,
        {
          substance,
          criticality: String(formData.get("criticality") ?? "") || undefined,
          reaction: String(formData.get("reaction") ?? "") || undefined,
          onsetDate: String(formData.get("onsetDate") ?? "") || undefined,
        },
        { ...prov, sourceDocumentId: original.sourceDocumentId ?? null },
      );
      newId = row.id;
      payload = {
        substance,
        criticality: row.criticality,
        reaction: row.reaction,
        onsetDate: row.onsetDate,
      };
    } else {
      const medication = String(formData.get("medication") ?? "").trim();
      if (!medication) return { error: "Medication name is required." };
      const row = await records.addMedication(
        patientId,
        {
          medication,
          dose: String(formData.get("dose") ?? "") || undefined,
          route: String(formData.get("route") ?? "") || undefined,
          frequency: String(formData.get("frequency") ?? "") || undefined,
          startDate: String(formData.get("startDate") ?? "") || undefined,
          status: String(formData.get("status") ?? "active") as
            | "active"
            | "stopped"
            | "completed",
          prescriberId: practitioner.id,
        },
        { ...prov, sourceDocumentId: original.sourceDocumentId ?? null },
      );
      newId = row.id;
      payload = {
        medication,
        dose: row.dose,
        route: row.route,
        frequency: row.frequency,
        startDate: row.startDate,
        status: row.status,
      };
    }

    // Original stays readable — supersede points at the replacement.
    await records.supersede({
      recordType: originalType,
      recordId: originalId,
      replacementId: newId,
      reason,
      actorId: user.id,
    });

    // Seal the corrected version, linked to the original's latest version
    // when one exists (§7.10: corrections are linked versions).
    const originalVersion = await recordVersions.currentVersion(originalId);
    await recordVersions.seal({
      resourceId: newId,
      resourceType: originalType,
      patientId,
      payload,
      authoredById: user.id,
      organizationId: practitioner.organizationId,
      sourceDocumentId: original.sourceDocumentId ?? null,
      reviewState: "attested",
      replacesVersionId: originalVersion?.id ?? null,
      correctionReason: reason,
      attestedBy: user.id,
    });

    await contradictionEngine.detect(patientId);
  } catch (err) {
    if (err instanceof AccessDeniedError)
      return { error: "You don't have consent to correct this record type." };
    if (err instanceof Error && err.message === "VERIFICATION_REQUIRED")
      return { error: "Your practitioner verification is still pending." };
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not save the correction." };
  }

  revalidatePath(`/portal/doctor/patients/${patientId}`);
  revalidatePath("/portal/patient/record");
  return {
    ok: "Correction saved. The original stays on record, marked superseded.",
  };
}
