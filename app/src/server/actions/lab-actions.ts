"use server";

/**
 * Lab/facility verification queue (BuildPlan §7.11).
 *
 * Safety rules encoded here:
 * - Viewing a report never marks a candidate "human reviewed"; only the
 *   explicit per-document attestation below does.
 * - attestDocumentAction accepts exactly ONE documentId per call — batch
 *   attestation of multiple reports is structurally impossible.
 * - Attestation only flips observations whose sourceDocumentId is exactly
 *   this document; unreviewed fields from other sources are never touched.
 */
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireUser, type SessionUser } from "@/server/session";
import { db } from "@/server/db";
import {
  clinicalResourceVersions,
  documents,
  observations,
  patients,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { field, FIELD_LIMITS } from "@/server/modules/security/field";
import { recordVersions } from "@/server/modules/records/versions";
import type { FormState } from "./auth-actions";

/* ------------------------------------------------------------------ */
/* Guard                                                               */
/* ------------------------------------------------------------------ */

/** Extracted lab reports in this org awaiting the verification queue. */
export type ReviewQueueItem = {
  documentId: string;
  patientId: string;
  patientName: string;
  title: string;
  recordedDate: string | null;
  createdAt: Date;
  fieldCount: number;
};

/** One candidate field derived from a document (§7.11 verification view). */
export type ReviewCandidate = {
  id: string;
  panel: string | null;
  name: string;
  value: string | null;
  valueString: string | null;
  unit: string | null;
  referenceRangeLow: string | null;
  referenceRangeHigh: string | null;
  flag: string;
  effectiveDate: string | null;
  reviewState: string;
  reviewedAt: Date | null;
};

async function requireLabRole(user: SessionUser): Promise<string | null> {
  if (user.role !== "lab_staff" && user.role !== "org_admin")
    return "Only lab staff or facility admins can use the verification queue.";
  if (!user.organizationId) return "Your account has no organization attached.";
  // Same gate as the policy engine's org path: staff of a pending/rejected
  // facility must not read patient lab values or seal trust, even for
  // documents their own org uploaded. Without this, an unverified facility
  // could read any patient's lab values routed through its queue.
  const { requireVerifiedOrganization } = await import("@/server/modules/identity/verification");
  try {
    await requireVerifiedOrganization(user.organizationId);
  } catch {
    return "Your facility's verification is still pending. The review queue unlocks once it is approved.";
  }
  return null;
}

/** Load one document, enforcing org match. Returns null when not accessible. */
async function orgDocument(documentId: string, organizationId: string) {
  const [doc] = await db
    .select({
      id: documents.id,
      patientId: documents.patientId,
      kind: documents.kind,
      title: documents.title,
      extractionStatus: documents.extractionStatus,
      extractionError: documents.extractionError,
      recordedDate: documents.recordedDate,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(
      and(eq(documents.id, documentId), eq(documents.organizationId, organizationId)),
    );
  return doc ?? null;
}

/** Current (non-superseded) observations derived from one document. */
async function documentObservations(documentId: string) {
  return db
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.sourceDocumentId, documentId),
        isNull(observations.supersededById),
      ),
    )
    .orderBy(observations.panel, observations.name);
}

/** Latest version review state per observation resource. */
async function latestReviewStates(resourceIds: string[]) {
  const states = new Map<string, { reviewState: string; reviewedAt: Date | null }>();
  if (!resourceIds.length) return states;
  const rows = await db
    .select({
      resourceId: clinicalResourceVersions.resourceId,
      reviewState: clinicalResourceVersions.reviewState,
      reviewedAt: clinicalResourceVersions.reviewedAt,
      version: clinicalResourceVersions.version,
    })
    .from(clinicalResourceVersions)
    .where(inArray(clinicalResourceVersions.resourceId, resourceIds))
    .orderBy(desc(clinicalResourceVersions.version));
  for (const r of rows) {
    if (!states.has(r.resourceId))
      states.set(r.resourceId, { reviewState: r.reviewState, reviewedAt: r.reviewedAt });
  }
  return states;
}

/* ------------------------------------------------------------------ */
/* Queue list                                                          */
/* ------------------------------------------------------------------ */

/**
 * Lab reports in the caller's organization whose extraction finished and
 * that still have at least one machine-extracted field not yet attested
 * (the per-observation version chain is the source of truth). Documents
 * marked structured_data_unavailable are excluded from the work list.
 */
export async function listReviewQueueAction(): Promise<ReviewQueueItem[]> {
  const user = await requireUser();
  const denied = await requireLabRole(user);
  if (denied) return [];
  const orgId = user.organizationId!;

  // Candidate documents: lab reports, extraction done, not flagged
  // structured_data_unavailable.
  const docs = await db
    .select({
      id: documents.id,
      patientId: documents.patientId,
      title: documents.title,
      recordedDate: documents.recordedDate,
      createdAt: documents.createdAt,
      extractionError: documents.extractionError,
      patientName: patients.fullName,
    })
    .from(documents)
    .innerJoin(patients, eq(patients.id, documents.patientId))
    .where(
      and(
        eq(documents.organizationId, orgId),
        eq(documents.kind, "lab_report"),
        eq(documents.extractionStatus, "done"),
        sql`${documents.extractionError} is distinct from 'structured_data_unavailable'`,
      ),
    )
    .orderBy(desc(documents.createdAt));

  if (!docs.length) return [];

  // Unattested observation counts per document. An observation is pending
  // while NO sealed version carries a human review state — attestation
  // appends a new "attested" version, so checking the version chain (not
  // the v1 row, which stays machine_extracted) is the source of truth.
  const rows = await db
    .select({
      sourceDocumentId: observations.sourceDocumentId,
      id: observations.id,
    })
    .from(observations)
    .where(
      and(
        isNull(observations.supersededById),
        sql`${observations.sourceDocumentId} is not null`,
        inArray(
          observations.sourceDocumentId!,
          docs.map((d) => d.id),
        ),
      ),
    );
  const reviewed = await latestReviewStates(rows.map((r) => r.id));

  const pendingByDoc = new Map<string, number>();
  for (const r of rows) {
    if (!r.sourceDocumentId) continue;
    if (reviewed.get(r.id)?.reviewState === "attested") continue;
    pendingByDoc.set(r.sourceDocumentId, (pendingByDoc.get(r.sourceDocumentId) ?? 0) + 1);
  }

  return docs.map((d) => ({
    documentId: d.id,
    patientId: d.patientId,
    patientName: d.patientName,
    title: d.title,
    recordedDate: d.recordedDate,
    createdAt: d.createdAt,
    fieldCount: pendingByDoc.get(d.id) ?? 0,
  })).filter((item) => item.fieldCount > 0);
}

/* ------------------------------------------------------------------ */
/* Candidate fields for one document                                   */
/* ------------------------------------------------------------------ */

export async function reviewCandidatesAction(formData: FormData): Promise<
  { ok: true; document: { id: string; title: string; extractionStatus: string; extractionError: string | null; recordedDate: string | null; patientId: string; patientName: string }; candidates: ReviewCandidate[] } | { ok: false; error: string }
> {
  const user = await requireUser();
  const denied = await requireLabRole(user);
  if (denied) return { ok: false, error: denied };

  const documentR = field(formData.get("documentId"), FIELD_LIMITS.short, { label: "Document", required: true });
  if (!documentR.ok) return { ok: false, error: documentR.error };
  const documentId = documentR.value;

  const doc = await orgDocument(documentId, user.organizationId!);
  if (!doc || doc.kind !== "lab_report")
    return { ok: false, error: "Document not found in your facility." };

  const [patient] = await db
    .select({ fullName: patients.fullName })
    .from(patients)
    .where(eq(patients.id, doc.patientId));

  const obs = await documentObservations(documentId);
  const states = await latestReviewStates(obs.map((o) => o.id));

  return {
    ok: true,
    document: {
      id: doc.id,
      title: doc.title,
      extractionStatus: doc.extractionStatus,
      extractionError: doc.extractionError,
      recordedDate: doc.recordedDate,
      patientId: doc.patientId,
      patientName: patient?.fullName ?? "Unknown patient",
    },
    candidates: obs.map((o) => ({
      id: o.id,
      panel: o.panel,
      name: o.name,
      value: o.value,
      valueString: o.valueString,
      unit: o.unit,
      referenceRangeLow: o.referenceRangeLow,
      referenceRangeHigh: o.referenceRangeHigh,
      flag: o.flag,
      effectiveDate: o.effectiveDate,
      reviewState: states.get(o.id)?.reviewState ?? "machine_extracted",
      reviewedAt: states.get(o.id)?.reviewedAt ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Attest and deliver (§7.11 — one document per call)                  */
/* ------------------------------------------------------------------ */

export async function attestDocumentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const denied = await requireLabRole(user);
  if (denied) return { error: denied };

  // Exactly one document per attestation — never a list.
  const documentR = field(formData.get("documentId"), FIELD_LIMITS.short, { label: "Document", required: true });
  if (!documentR.ok) return { error: documentR.error };
  const documentId = documentR.value;
  if (String(formData.get("confirm") ?? "") !== "on")
    return {
      error:
        "Check the confirmation box: you must compare each value against the original report before attesting.",
    };

  const doc = await orgDocument(documentId, user.organizationId!);
  if (!doc || doc.kind !== "lab_report")
    return { error: "Document not found in your facility." };
  if (doc.extractionStatus !== "done")
    return { error: "Extraction has not finished for this document yet." };

  const obs = await documentObservations(documentId);
  if (!obs.length)
    return { error: "This document has no extracted fields to attest. Use “Mark unable to verify” to deliver the original." };

  // Seal an attested version for each observation resource. seal() only
  // touches the resource named in the call, so unreviewed fields from other
  // documents can never be swept into this attestation.
  let sealed = 0;
  for (const o of obs) {
    await recordVersions.seal({
      resourceId: o.id,
      resourceType: "observation",
      patientId: doc.patientId,
      payload: {
        name: o.name,
        panel: o.panel,
        value: o.value,
        valueString: o.valueString,
        unit: o.unit,
        referenceRangeLow: o.referenceRangeLow,
        referenceRangeHigh: o.referenceRangeHigh,
        flag: o.flag,
        effectiveDate: o.effectiveDate,
      },
      authoredById: user.id,
      organizationId: user.organizationId,
      sourceDocumentId: documentId,
      reviewState: "attested",
      attestedBy: user.id,
    });
    sealed++;
  }

  try {
    await audit.record({
      actorId: user.id,
      actorRole: user.role,
      patientId: doc.patientId,
      organizationId: user.organizationId,
      action: "document.attested",
      resourceType: "document",
      resourceId: documentId,
      metadata: { fieldsAttested: sealed },
    });
  } catch (err) {
    console.error("[audit] write failed (document.attested)", err);
  }

  revalidatePath("/portal/org");
  revalidatePath(`/portal/org/review/${documentId}`);
  return { ok: `Attested ${sealed} field${sealed === 1 ? "" : "s"} and delivered the report.` };
}

/* ------------------------------------------------------------------ */
/* Mark unable to verify (source_available / structured_data_unavailable) */
/* ------------------------------------------------------------------ */

export async function markUnableToVerifyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const denied = await requireLabRole(user);
  if (denied) return { error: denied };

  const documentR = field(formData.get("documentId"), FIELD_LIMITS.short, { label: "Document", required: true });
  if (!documentR.ok) return { error: documentR.error };
  const documentId = documentR.value;

  const doc = await orgDocument(documentId, user.organizationId!);
  if (!doc || doc.kind !== "lab_report")
    return { error: "Document not found in your facility." };

  // Org predicate on the write itself, not just the read above: without
  // it a concurrent org reassignment between orgDocument and this update
  // would mark a document that no longer belongs to this facility.
  const [marked] = await db
    .update(documents)
    .set({ extractionError: "structured_data_unavailable" })
    .where(
      and(eq(documents.id, documentId), eq(documents.organizationId, user.organizationId!)),
    )
    .returning();
  if (!marked) return { error: "Document not found in your facility." };

  try {
    await audit.record({
      actorId: user.id,
      actorRole: user.role,
      patientId: doc.patientId,
      organizationId: user.organizationId,
      action: "document.marked_unable_to_verify",
      resourceType: "document",
      resourceId: documentId,
      reason: "structured_data_unavailable",
    });
  } catch (err) {
    console.error("[audit] write failed (document.marked_unable_to_verify)", err);
  }

  revalidatePath("/portal/org");
  revalidatePath(`/portal/org/review/${documentId}`);
  return {
    ok: "Marked unable to verify — the original document will be delivered as-is; viewers are told to rely on the original.",
  };
}
