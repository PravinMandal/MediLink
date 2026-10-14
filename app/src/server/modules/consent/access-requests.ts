/**
 * Access requests (BuildPlan §8.3): a pending request is first-class data,
 * not an inferred audit event. State machine:
 *
 * draft -> submitted -> patient_viewed -> approved (-> consent_grant)
 *                                  |-> declined
 *                        submitted -> expired / cancelled
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accessRequests,
  consentArtifacts,
  consents,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { notify } from "@/server/modules/notifications/service";
import { OFFERED_SCOPES, type ConsentScope } from "@/server/modules/consent/service";
import { createHash } from "node:crypto";
import { POLICY_VERSION } from "@/server/modules/access/policy";

export const MAX_REQUEST_DAYS = 90;
export const MIN_REQUEST_DAYS = 1;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

function receiptCode(): string {
  // Non-secret, human-transcribable reference for the consent receipt.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `ML-${out.slice(0, 5)}-${out.slice(5)}`;
}

/** Requests that are past their submitted staleness window expire. */
const REQUEST_TTL_DAYS = 30;

export const accessRequestsService = {
  /** The deciding user must own the patient record. */
  async assertOwnership(patientUserId: string, patientId: string) {
    const { patients } = await import("@/server/db/schema");
    const [row] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.userId, patientUserId)));
    if (!row) throw new Error("ACCESS_DENIED");
  },
  async createDraft(input: {
    patientId: string;
    requesterUserId: string;
    requesterPractitionerId?: string | null;
    requesterOrganizationId?: string | null;
    requesterSnapshot: { name: string; credentialStatus: string; organization?: string | null; specialty?: string | null };
    purpose: string;
    purposeDetail?: string;
    visitReference?: string;
    suggestedScopes?: string[];
    requestedDays: number;
  }) {
    if (input.requestedDays < MIN_REQUEST_DAYS || input.requestedDays > MAX_REQUEST_DAYS) {
      throw new Error(`Requested duration must be ${MIN_REQUEST_DAYS}-${MAX_REQUEST_DAYS} days.`);
    }
    const [row] = await db
      .insert(accessRequests)
      .values({
        patientId: input.patientId,
        requesterUserId: input.requesterUserId,
        requesterPractitionerId: input.requesterPractitionerId ?? null,
        requesterOrganizationId: input.requesterOrganizationId ?? null,
        requesterSnapshot: input.requesterSnapshot,
        purpose: input.purpose,
        purposeDetail: input.purposeDetail ?? null,
        visitReference: input.visitReference ?? null,
        suggestedScopes: input.suggestedScopes ?? [],
        requestedDays: input.requestedDays,
        status: "draft",
        correlationId: crypto.randomUUID(),
      })
      .returning();
    return row;
  },

  async submit(requesterUserId: string, requestId: string) {
    const [row] = await db
      .update(accessRequests)
      .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(accessRequests.id, requestId),
          eq(accessRequests.requesterUserId, requesterUserId),
          eq(accessRequests.status, "draft"),
        ),
      )
      .returning();
    if (!row) throw new Error("Request not found or not in draft state.");
    await audit.record({
      actorId: requesterUserId,
      actorRole: "doctor",
      patientId: row.patientId,
      action: "access_request.submitted",
      resourceType: "access_request",
      resourceId: requestId,
      metadata: { purpose: row.purpose, suggestedScopes: row.suggestedScopes, correlationId: row.correlationId },
    });
    // Notify the patient's linked account if any.
    const { patients } = await import("@/server/db/schema");
    const [p] = await db.select({ userId: patients.userId }).from(patients).where(eq(patients.id, row.patientId));
    if (p?.userId) {
      await notify.push({
        userId: p.userId,
        type: "access_request",
        title: "A doctor has requested access to your record",
        body: `${row.requesterSnapshot.name} requested access: ${row.purpose}`,
        link: "/portal/patient/consents",
      });
    }
    return row;
  },

  async pendingForPatient(patientId: string) {
    // Expire stale submitted requests before reading.
    await this.expireStale();
    return db
      .select()
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.patientId, patientId),
          inArray(accessRequests.status, ["submitted", "patient_viewed"]),
        ),
      )
      .orderBy(desc(accessRequests.submittedAt));
  },

  async byId(id: string) {
    const [row] = await db.select().from(accessRequests).where(eq(accessRequests.id, id));
    return row ?? null;
  },

  async listForRequester(requesterUserId: string) {
    return db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.requesterUserId, requesterUserId))
      .orderBy(desc(accessRequests.createdAt));
  },

  /** Patient opens the request — transitions submitted -> patient_viewed. */
  async markViewed(patientUserId: string, requestId: string) {
    // Ownership is asserted BEFORE the write, and the write itself is
    // status-guarded (submitted-only): a replay or a forged requestId
    // flips nothing and throws nothing observable.
    const [req] = await db
      .select({ patientId: accessRequests.patientId })
      .from(accessRequests)
      .where(eq(accessRequests.id, requestId));
    if (!req) return;
    await this.assertOwnership(patientUserId, req.patientId);
    await db
      .update(accessRequests)
      .set({ status: "patient_viewed", patientViewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(accessRequests.id, requestId), eq(accessRequests.status, "submitted")));
  },

  /**
   * Patient decision. Approved scopes are the PATIENT's explicit selection —
   * never copied from the requester's suggested set. No preselection is
   * applied here: an empty scope selection is rejected.
   */
  async decide(input: {
    patientUserId: string;
    patientId: string;
    requestId: string;
    decision: "approve" | "decline";
    approvedScopes?: ConsentScope[];
    days?: number; // patient may narrow the duration
    reason?: string;
    granteeUserId?: string | null;
  }) {
    const [req] = await db
      .select()
      .from(accessRequests)
      .where(eq(accessRequests.id, input.requestId));
    if (!req) throw new Error("Request not found.");
    if (!["submitted", "patient_viewed"].includes(req.status)) {
      throw new Error(`Request is not awaiting a decision (status: ${req.status}).`);
    }
    await this.assertOwnership(input.patientUserId, req.patientId);

    if (input.decision === "decline") {
      const [row] = await db
        .update(accessRequests)
        .set({
          status: "declined",
          respondedAt: new Date(),
          patientResponseReason: input.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(accessRequests.id, input.requestId))
        .returning();
      await audit.record({
        actorId: input.patientUserId,
        actorRole: "patient",
        patientId: req.patientId,
        action: "access_request.declined",
        resourceType: "access_request",
        resourceId: input.requestId,
        reason: input.reason ?? null,
      });
      await notify.push({
        userId: req.requesterUserId,
        type: "access_request",
        title: "The patient declined your access request",
        body: "They may still share documents with you another way.",
        link: "/portal/doctor",
      });
      return row;
    }

    const scopes = (input.approvedScopes ?? []).filter((s) =>
      (OFFERED_SCOPES as string[]).includes(s),
    );
    if (!scopes.length) throw new Error("Select at least one category to grant.");
    // NaN-safe duration: NaN ?? x stays NaN, so validate explicitly —
    // otherwise expiresAt becomes Invalid Date and the grant is immortal.
    const wanted = Number(input.days ?? req.requestedDays);
    if (!Number.isFinite(wanted)) throw new Error("Invalid grant duration.");
    const days = Math.min(
      Math.max(Math.floor(wanted), MIN_REQUEST_DAYS),
      Math.min(req.requestedDays, MAX_REQUEST_DAYS),
    );
    // The grant, audit, and artefact all bind to the DB-owned patient id —
    // never the caller-supplied input.patientId (ownership poisoning).
    const patientId = req.patientId;

    // Create the consent grant tied to the request.
    const [grant] = await db
      .insert(consents)
      .values({
        patientId,
        granteeType: req.requesterPractitionerId ? "practitioner" : "organization",
        granteePractitionerId: req.requesterPractitionerId,
        granteeOrganizationId: req.requesterOrganizationId,
        scopes,
        purpose: (req.purpose === "emergency" ? "emergency" : req.purpose === "record_review" ? "record_review" : req.purpose === "consultation" ? "consultation" : "treatment") as
          | "treatment" | "consultation" | "emergency" | "record_review",
        status: "active",
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        accessRequestId: req.id,
        policyVersion: POLICY_VERSION,
        receiptCode: receiptCode(),
      })
      .returning();

    // Immutable consent artefact with hash.
    const artifact = {
      version: 1,
      policyVersion: POLICY_VERSION,
      request: {
        id: req.id,
        correlationId: req.correlationId,
        purpose: req.purpose,
        purposeDetail: req.purposeDetail,
        visitReference: req.visitReference,
        requestedDays: req.requestedDays,
        suggestedScopes: req.suggestedScopes,
        requester: req.requesterSnapshot,
        submittedAt: req.submittedAt?.toISOString() ?? null,
      },
      grant: {
        consentId: grant.id,
        approvedScopes: scopes,
        grantedDays: days,
        grantedAt: grant.grantedAt.toISOString(),
        expiresAt: grant.expiresAt.toISOString(),
      },
      patient: { patientId },
    };
    await db.insert(consentArtifacts).values({
      consentId: grant.id,
      accessRequestId: req.id,
      artifact,
      artifactSha256: createHash("sha256").update(stableStringify(artifact)).digest("hex"),
      policyVersion: POLICY_VERSION,
      receiptCode: grant.receiptCode!,
    });

    const [row] = await db
      .update(accessRequests)
      .set({
        status: "approved",
        respondedAt: new Date(),
        patientResponseReason: input.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(accessRequests.id, input.requestId))
      .returning();

    await audit.record({
      actorId: input.patientUserId,
      actorRole: "patient",
      patientId,
      action: "access_request.approved",
      resourceType: "consent",
      resourceId: grant.id,
      metadata: {
        requestId: req.id,
        approvedScopes: scopes,
        days,
        correlationId: req.correlationId,
      },
    });
    await notify.push({
      userId: req.requesterUserId,
      type: "consent.granted",
      title: "A patient granted you access",
      body: `Approved categories: ${scopes.join(", ")} · valid ${days} days`,
      link: "/portal/doctor",
    });
    return { request: row, grant, receiptCode: grant.receiptCode! };
  },

  async cancel(requesterUserId: string, requestId: string) {
    const [row] = await db
      .update(accessRequests)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(accessRequests.id, requestId),
          eq(accessRequests.requesterUserId, requesterUserId),
          inArray(accessRequests.status, ["draft", "submitted", "patient_viewed"]),
        ),
      )
      .returning();
    if (row) {
      await audit.record({
        actorId: requesterUserId,
        actorRole: "doctor",
        patientId: row.patientId,
        action: "access_request.cancelled",
        resourceType: "access_request",
        resourceId: requestId,
      });
    }
    return row;
  },

  async expireStale() {
    const cutoff = new Date(Date.now() - REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
    const stale = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(
        and(
          inArray(accessRequests.status, ["submitted", "patient_viewed"]),
        ),
      );
    if (!stale.length) return;
    const staleIds: string[] = [];
    for (const s of stale) {
      const [row] = await db
        .select({ submittedAt: accessRequests.submittedAt })
        .from(accessRequests)
        .where(eq(accessRequests.id, s.id));
      if (row?.submittedAt && row.submittedAt < cutoff) staleIds.push(s.id);
    }
    if (!staleIds.length) return;
    await db
      .update(accessRequests)
      .set({ status: "expired", updatedAt: new Date() })
      .where(inArray(accessRequests.id, staleIds));
  },

  async artifactForConsent(consentId: string) {
    const [row] = await db
      .select()
      .from(consentArtifacts)
      .where(eq(consentArtifacts.consentId, consentId))
      .orderBy(desc(consentArtifacts.createdAt))
      .limit(1);
    return row ?? null;
  },
};
