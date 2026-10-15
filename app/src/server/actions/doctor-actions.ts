"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser, type SessionUser } from "@/server/session";
import { field, optField, FIELD_LIMITS } from "@/server/modules/security/field";
import { access, AccessDeniedError, EMERGENCY_SCOPES, scopeForResource } from "@/server/modules/access/guard";
import {
  submitPractitionerVerification,
  requireVerifiedPractitioner,
} from "@/server/modules/identity/verification";
import { records } from "@/server/modules/records/service";
import {
  ingestDocumentV2,
  retryExtraction as retryExtractionV2,
} from "@/server/modules/documents/pipeline-v2";
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
    const fullNameR = field(formData.get("fullName"), FIELD_LIMITS.short, { label: "Full name", required: true });
    if (!fullNameR.ok) return { error: fullNameR.error };
    const regR = field(formData.get("registrationNumber"), FIELD_LIMITS.short, { label: "Registration number", required: true });
    if (!regR.ok) return { error: regR.error };
    const councilR = optField(formData.get("council"), FIELD_LIMITS.short, { label: "Council" });
    if (!councilR.ok) return { error: councilR.error };
    const qualR = optField(formData.get("qualification"), FIELD_LIMITS.short, { label: "Qualification" });
    if (!qualR.ok) return { error: qualR.error };
    const specialtyR = optField(formData.get("specialty"), FIELD_LIMITS.short, { label: "Specialty" });
    if (!specialtyR.ok) return { error: specialtyR.error };
    await submitPractitionerVerification({
      userId: user.id,
      fullName: fullNameR.value,
      registrationNumber: regR.value,
      council: councilR.value,
      qualification: qualR.value,
      specialty: specialtyR.value,
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
  const patientR = field(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient", required: true });
  if (!patientR.ok) return { error: patientR.error };
  const kindR = field(formData.get("kind"), FIELD_LIMITS.short, { label: "Record type", required: true });
  if (!kindR.ok) return { error: kindR.error };
  const patientId = patientR.value;
  const kind = kindR.value;

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
        const nameR = field(formData.get("name"), FIELD_LIMITS.short, { label: "Condition name", required: true });
        if (!nameR.ok) return { error: nameR.error };
        const notesR = optField(formData.get("notes"), FIELD_LIMITS.long, { label: "Notes" });
        if (!notesR.ok) return { error: notesR.error };
        const statusR = field(formData.get("status") ?? "active", FIELD_LIMITS.short, { label: "Status" });
        if (!statusR.ok) return { error: statusR.error };
        const onsetR = optField(formData.get("onsetDate"), FIELD_LIMITS.short, { label: "Onset date" });
        if (!onsetR.ok) return { error: onsetR.error };
        await records.addCondition(
          patientId,
          {
            name: nameR.value,
            status: (statusR.value as "active" | "chronic" | "resolved"),
            onsetDate: onsetR.value,
            notes: notesR.value,
          },
          prov,
        );
        break;
      }
      case "allergy": {
        const substanceR = field(formData.get("substance"), FIELD_LIMITS.short, { label: "Allergy substance", required: true });
        if (!substanceR.ok) return { error: substanceR.error };
        const criticalityR = optField(formData.get("criticality"), FIELD_LIMITS.medium, { label: "Criticality" });
        if (!criticalityR.ok) return { error: criticalityR.error };
        const reactionR = optField(formData.get("reaction"), FIELD_LIMITS.medium, { label: "Reaction" });
        if (!reactionR.ok) return { error: reactionR.error };
        await records.addAllergy(
          patientId,
          {
            substance: substanceR.value,
            criticality: criticalityR.value,
            reaction: reactionR.value,
          },
          prov,
        );
        break;
      }
      case "medication": {
        const medicationR = field(formData.get("medication"), FIELD_LIMITS.short, { label: "Medication name", required: true });
        if (!medicationR.ok) return { error: medicationR.error };
        const doseR = optField(formData.get("dose"), FIELD_LIMITS.medium, { label: "Dose" });
        if (!doseR.ok) return { error: doseR.error };
        const frequencyR = optField(formData.get("frequency"), FIELD_LIMITS.medium, { label: "Frequency" });
        if (!frequencyR.ok) return { error: frequencyR.error };
        const startR = optField(formData.get("startDate"), FIELD_LIMITS.short, { label: "Start date" });
        if (!startR.ok) return { error: startR.error };
        await records.addMedication(
          patientId,
          {
            medication: medicationR.value,
            dose: doseR.value,
            frequency: frequencyR.value,
            startDate: startR.value,
            prescriberId: practitioner.id,
          },
          prov,
        );
        break;
      }
      case "observation": {
        const nameR = field(formData.get("name"), FIELD_LIMITS.short, { label: "Observation name", required: true });
        if (!nameR.ok) return { error: nameR.error };
        const rawValueR = optField(formData.get("value"), FIELD_LIMITS.medium, { label: "Value" });
        if (!rawValueR.ok) return { error: rawValueR.error };
        const rawValue = rawValueR.value ?? "";
        const numeric = rawValue ? Number(rawValue.replace(/,/g, "")) : null;
        const panelR = optField(formData.get("panel"), FIELD_LIMITS.medium, { label: "Panel" });
        if (!panelR.ok) return { error: panelR.error };
        const unitR = optField(formData.get("unit"), FIELD_LIMITS.medium, { label: "Unit" });
        if (!unitR.ok) return { error: unitR.error };
        const effectiveR = optField(formData.get("effectiveDate"), FIELD_LIMITS.short, { label: "Effective date" });
        if (!effectiveR.ok) return { error: effectiveR.error };
        await records.addObservation(
          patientId,
          {
            name: nameR.value,
            panel: panelR.value,
            value: numeric != null && Number.isFinite(numeric) ? numeric : null,
            valueString: numeric == null ? rawValue || null : null,
            unit: unitR.value,
            effectiveDate: effectiveR.value,
          },
          prov,
        );
        break;
      }
      case "procedure": {
        const nameR = field(formData.get("name"), FIELD_LIMITS.short, { label: "Procedure name", required: true });
        if (!nameR.ok) return { error: nameR.error };
        const outcomeR = optField(formData.get("outcome"), FIELD_LIMITS.long, { label: "Outcome" });
        if (!outcomeR.ok) return { error: outcomeR.error };
        const performedR = optField(formData.get("performedDate"), FIELD_LIMITS.short, { label: "Performed date" });
        if (!performedR.ok) return { error: performedR.error };
        await records.addProcedure(
          patientId,
          {
            name: nameR.value,
            performedDate: performedR.value,
            outcome: outcomeR.value,
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
  const patientR = field(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient", required: true });
  if (!patientR.ok) return { error: patientR.error };
  const documentR = field(formData.get("documentId"), FIELD_LIMITS.short, { label: "Document", required: true });
  if (!documentR.ok) return { error: documentR.error };
  const patientId = patientR.value;
  const documentId = documentR.value;

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
  const patientR = field(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient", required: true });
  if (!patientR.ok) return { error: patientR.error };
  const file = formData.get("file");
  const titleR = field(formData.get("title"), FIELD_LIMITS.short, { label: "Title", required: true });
  if (!titleR.ok) return { error: titleR.error };
  const kindR = field(formData.get("kind") ?? "lab_report", FIELD_LIMITS.short, { label: "Kind" });
  if (!kindR.ok) return { error: kindR.error };
  const kind = kindR.value as Parameters<
    typeof ingestDocumentV2
  >[0]["kind"];
  const recordedR = optField(formData.get("recordedDate"), FIELD_LIMITS.short, { label: "Recorded date" });
  if (!recordedR.ok) return { error: recordedR.error };
  const recordedDate = recordedR.value;
  const patientId = patientR.value;
  const title = titleR.value;

  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.name.length > FIELD_LIMITS.short) return { error: "File name is too long (max 200 characters). Rename it and try again." };

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
  const patientR = field(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient", required: true });
  if (!patientR.ok) return { error: patientR.error };
  const questionR = optField(formData.get("question"), FIELD_LIMITS.long, { label: "Question" });
  if (!questionR.ok) return { error: questionR.error };
  const patientId = patientR.value;
  const question = questionR.value;

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
  const patientIdR = optField(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient" });
  if (!patientIdR.ok) return { error: patientIdR.error };
  let patientId = patientIdR.value ?? "";
  const identifierR = optField(formData.get("patientIdText"), FIELD_LIMITS.short, { label: "Patient identifier" });
  if (!identifierR.ok) return { error: identifierR.error };
  const identifier = identifierR.value ?? "";
  const reasonR = optField(formData.get("reason"), FIELD_LIMITS.long, { label: "Reason" });
  if (!reasonR.ok) return { error: reasonR.error };
  const reason = reasonR.value ?? "";
  const stepUpR = optField(formData.get("stepUpPassword"), FIELD_LIMITS.short, { label: "Password" });
  if (!stepUpR.ok) return { error: stepUpR.error };
  const stepUpPassword = stepUpR.value ?? "";

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
  if (!(await hasFreshStepUp(user.id))) {
    if (!stepUpPassword) {
      return {
        error:
          "Emergency access requires re-entering your password to confirm it is you. Enter your password and try again.",
      };
    }
    const ok = await confirmStepUp(user.id, stepUpPassword);
    if (!ok) return { error: "Password check failed. Try again." };
  }

  // Per-doctor abuse limit, shared with the service-layer budget.
  const { rateLimit, LIMITS } = await import("@/server/modules/security/rate-limit");
  if (!rateLimit(`breakglass:${user.id}`, LIMITS.breakGlass)) {
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
 * original. Insert + supersede + version seal commit atomically inside
 * records.correct() — the old three-call sequence could strand a duplicate
 * live row or an unattested visible correction on crash. A mandatory
 * correction reason is stored with the version chain.
 */
export async function correctRecordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientR = field(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient", required: true });
  if (!patientR.ok) return { error: patientR.error };
  const patientId = patientR.value;
  const originalTypeRawR = field(formData.get("originalType"), FIELD_LIMITS.short, { label: "Record type" });
  if (!originalTypeRawR.ok) return { error: originalTypeRawR.error };
  const originalTypeRaw = originalTypeRawR.value;
  const originalR = field(formData.get("originalId"), FIELD_LIMITS.short, { label: "Record", required: true });
  if (!originalR.ok) return { error: originalR.error };
  const originalId = originalR.value;
  const reasonR = field(formData.get("reason"), FIELD_LIMITS.long, { label: "Correction reason", required: true });
  if (!reasonR.ok) return { error: reasonR.error };
  const reason = reasonR.value;

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

    let data: Parameters<typeof records.correct>[0]["data"];
    if (originalType === "condition") {
      const nameR = field(formData.get("name"), FIELD_LIMITS.short, { label: "Condition name", required: true });
      if (!nameR.ok) return { error: nameR.error };
      const statusR = field(formData.get("status") ?? "active", FIELD_LIMITS.short, { label: "Status" });
      if (!statusR.ok) return { error: statusR.error };
      const onsetR = optField(formData.get("onsetDate"), FIELD_LIMITS.short, { label: "Onset date" });
      if (!onsetR.ok) return { error: onsetR.error };
      const notesR = optField(formData.get("notes"), FIELD_LIMITS.long, { label: "Notes" });
      if (!notesR.ok) return { error: notesR.error };
      data = {
        kind: "condition",
        name: nameR.value,
        status: statusR.value as
          | "active"
          | "resolved"
          | "chronic",
        onsetDate: onsetR.value,
        notes: notesR.value,
      };
    } else if (originalType === "allergy") {
      const substanceR = field(formData.get("substance"), FIELD_LIMITS.short, { label: "Allergy substance", required: true });
      if (!substanceR.ok) return { error: substanceR.error };
      const critR = optField(formData.get("criticality"), FIELD_LIMITS.medium, { label: "Criticality" });
      if (!critR.ok) return { error: critR.error };
      const reactR = optField(formData.get("reaction"), FIELD_LIMITS.medium, { label: "Reaction" });
      if (!reactR.ok) return { error: reactR.error };
      const onsetR = optField(formData.get("onsetDate"), FIELD_LIMITS.short, { label: "Onset date" });
      if (!onsetR.ok) return { error: onsetR.error };
      data = {
        kind: "allergy",
        substance: substanceR.value,
        criticality: critR.value,
        reaction: reactR.value,
        onsetDate: onsetR.value,
      };
    } else {
      const medicationR = field(formData.get("medication"), FIELD_LIMITS.short, { label: "Medication name", required: true });
      if (!medicationR.ok) return { error: medicationR.error };
      const doseR = optField(formData.get("dose"), FIELD_LIMITS.medium, { label: "Dose" });
      if (!doseR.ok) return { error: doseR.error };
      const routeR = optField(formData.get("route"), FIELD_LIMITS.medium, { label: "Route" });
      if (!routeR.ok) return { error: routeR.error };
      const freqR = optField(formData.get("frequency"), FIELD_LIMITS.medium, { label: "Frequency" });
      if (!freqR.ok) return { error: freqR.error };
      const startR = optField(formData.get("startDate"), FIELD_LIMITS.short, { label: "Start date" });
      if (!startR.ok) return { error: startR.error };
      const statusR = field(formData.get("status") ?? "active", FIELD_LIMITS.short, { label: "Status" });
      if (!statusR.ok) return { error: statusR.error };
      data = {
        kind: "medication",
        medication: medicationR.value,
        dose: doseR.value,
        route: routeR.value,
        frequency: freqR.value,
        startDate: startR.value,
        status: statusR.value as
          | "active"
          | "stopped"
          | "completed",
        prescriberId: practitioner.id,
      };
    }

    // Atomic: replacement insert + original supersede + version seal commit
    // in one transaction (records.correct). Audit lands post-commit.
    await records.correct({
      recordType: originalType,
      recordId: originalId,
      patientId,
      reason,
      actorId: user.id,
      organizationId: practitioner.organizationId,
      sourceDocumentId: original.sourceDocumentId ?? null,
      data,
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

/* ------------------------------------------------------------------ */
/* Patient dispute resolution (BuildPlan §7.10, Backlog D)              */
/* ------------------------------------------------------------------ */

/**
 * Resolve a patient's flagged concern. Only a verified practitioner with an
 * active authorization on the record (consent or live emergency window) may
 * resolve — via the same scope mapping as reads. Confirming keeps the
 * dispute visible as confirmed (correction follows separately);
 * dismissing requires notes for accountability.
 */
export async function resolveDisputeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "doctor") return { error: "Only clinicians resolve concerns." };
  const disputeR = field(formData.get("disputeId"), FIELD_LIMITS.short, { label: "Concern", required: true });
  if (!disputeR.ok) return { error: disputeR.error };
  const patientR = field(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient", required: true });
  if (!patientR.ok) return { error: patientR.error };
  const disputeId = disputeR.value;
  const patientId = patientR.value;
  const decisionR = field(formData.get("decision"), FIELD_LIMITS.short, { label: "Decision", required: true });
  if (!decisionR.ok) return { error: decisionR.error };
  const decision = decisionR.value;
  const notesR = optField(formData.get("notes"), FIELD_LIMITS.long, { label: "Notes" });
  if (!notesR.ok) return { error: notesR.error };
  const notes = notesR.value ?? "";
  if (decision !== "confirm" && decision !== "dismiss") {
    return { error: "Choose whether the concern is confirmed or dismissed." };
  }
  if (decision === "dismiss" && notes.length < 5) {
    return { error: "Dismissing needs a short note so the patient knows why." };
  }

  try {
    await requireVerifiedPractitioner(user.id);
    const { db } = await import("@/server/db");
    const { dataDisputes } = await import("@/server/db/schema");
    const { eq, and } = await import("drizzle-orm");
    const [dispute] = await db
      .select()
      .from(dataDisputes)
      .where(
        and(eq(dataDisputes.id, disputeId), eq(dataDisputes.patientId, patientId)),
      );
    if (!dispute || dispute.status !== "open") {
      return { error: "This concern is already handled or missing." };
    }
    // Scope check follows the disputed record kind — same mapping as reads.
    await access.assert(
      guardUser(user),
      patientId,
      scopeForResource(dispute.resourceType),
    );
    const { disputes } = await import("@/server/modules/records/versions");
    await disputes.resolve({
      disputeId: dispute.id,
      resolvedBy: user.id,
      status: decision === "confirm" ? "resolved_disputed" : "resolved_rejected",
      notes: notes || undefined,
    });
  } catch (err) {
    if (err instanceof AccessDeniedError)
      return { error: "You don't have consent covering this record." };
    if (err instanceof Error && err.message === "VERIFICATION_REQUIRED")
      return { error: "Your practitioner verification is still pending." };
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not resolve the concern." };
  }

  revalidatePath(`/portal/doctor/patients/${patientId}`);
  revalidatePath("/portal/patient/record");
  return {
    ok:
      decision === "confirm"
        ? "Concern confirmed and recorded — correct the record next if needed."
        : "Concern dismissed with notes for the patient.",
  };
}
