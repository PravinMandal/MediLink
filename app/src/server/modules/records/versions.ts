/**
 * Immutable clinical record versions + attestations (BuildPlan §9.3, Backlog B).
 *
 * Every structured write allocates a stable resource ID and appends a new
 * immutable version row: canonical JSON payload, payload_sha256, contributor
 * and credential snapshot, source document/page refs, lifecycle status.
 * Corrections create linked new versions — originals are never mutated.
 */
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  attestations,
  clinicalResourceVersions,
  dataDisputes,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { outbox } from "@/server/modules/jobs/outbox";

export type LifecycleStatus =
  | "active"
  | "corrected"
  | "superseded"
  | "entered_in_error"
  | "disputed";

export type ReviewState =
  | "not_required"
  | "machine_extracted"
  | "human_reviewed"
  | "attested";

/** Deterministic canonical JSON: sorted keys, no insignificant whitespace. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export const ATTESTATION_TEXT =
  "You confirm this structured entry accurately represents the source or your clinical entry. Later corrections create a linked correction; they do not overwrite this version.";

export const recordVersions = {
  /**
   * Append a new version. If the payload supersedes a prior version, pass
   * `replacesVersionId` + correctionReason — the old version flips to
   * `superseded` in the same transaction.
   */
  async seal(input: {
    resourceId: string;
    resourceType: string;
    patientId: string;
    payload: Record<string, unknown>;
    authoredById: string;
    organizationId?: string | null;
    credentialSnapshot?: Record<string, unknown> | null;
    sourceDocumentId?: string | null;
    pageRefs?: Array<{ page: number; region?: string }> | null;
    reviewState?: ReviewState;
    replacesVersionId?: string | null;
    correctionReason?: string | null;
    attestedBy?: string | null;
  }): Promise<{ versionId: string; payloadSha256: string; version: number }> {
    const canonical = canonicalize(input.payload);
    const payloadSha256 = createHash("sha256").update(canonical).digest("hex");

    const result = await db.transaction(async (tx) => {
      // Next version number for the resource.
      const [latest] = await tx
        .select({ version: clinicalResourceVersions.version })
        .from(clinicalResourceVersions)
        .where(eq(clinicalResourceVersions.resourceId, input.resourceId))
        .orderBy(desc(clinicalResourceVersions.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;

      // Supersede the replaced version atomically.
      if (input.replacesVersionId) {
        await tx
          .update(clinicalResourceVersions)
          .set({ lifecycleStatus: "superseded" })
          .where(
            and(
              eq(clinicalResourceVersions.id, input.replacesVersionId),
              eq(clinicalResourceVersions.resourceId, input.resourceId),
            ),
          );
      }

      const [row] = await tx
        .insert(clinicalResourceVersions)
        .values({
          resourceId: input.resourceId,
          resourceType: input.resourceType,
          patientId: input.patientId,
          version,
          payload: input.payload,
          payloadSha256,
          lifecycleStatus: input.replacesVersionId ? "corrected" : "active",
          replacesVersionId: input.replacesVersionId ?? null,
          correctionReason: input.correctionReason ?? null,
          authoredById: input.authoredById,
          organizationId: input.organizationId ?? null,
          credentialSnapshot: input.credentialSnapshot ?? null,
          sourceDocumentId: input.sourceDocumentId ?? null,
          pageRefs: input.pageRefs ?? null,
          reviewState: input.reviewState ?? "not_required",
          reviewedBy: input.reviewState === "human_reviewed" || input.reviewState === "attested"
            ? input.authoredById
            : null,
          reviewedAt:
            input.reviewState === "human_reviewed" || input.reviewState === "attested"
              ? new Date()
              : null,
        })
        .returning();

      if (input.attestedBy) {
        await tx.insert(attestations).values({
          versionId: row!.id,
          attestedBy: input.attestedBy,
          attestationText: ATTESTATION_TEXT,
        });
      }

      // Outbox event in the same transaction for indexing/notifications.
      await outbox.publish(
        {
          aggregateType: "clinical_resource_version",
          aggregateId: row!.id,
          type: input.replacesVersionId
            ? "clinical_version.corrected"
            : "clinical_version.sealed",
          payload: {
            versionId: row!.id,
            resourceId: input.resourceId,
            resourceType: input.resourceType,
            patientId: input.patientId,
            payloadSha256,
          },
          tx: tx as unknown as Pick<typeof db, "insert">,
        },
      );

      return { versionId: row!.id, payloadSha256, version };
    });

    await audit.record({
      actorId: input.authoredById,
      patientId: input.patientId,
      organizationId: input.organizationId ?? null,
      action: input.replacesVersionId
        ? "record_version.corrected"
        : "record_version.sealed",
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: { versionId: result.versionId, version: result.version, payloadSha256 },
    });

    return result;
  },

  /** Full version history for a resource (canonical identity). */
  async history(resourceId: string) {
    return db
      .select()
      .from(clinicalResourceVersions)
      .where(eq(clinicalResourceVersions.resourceId, resourceId))
      .orderBy(desc(clinicalResourceVersions.version));
  },

  async currentVersion(resourceId: string) {
    const [row] = await db
      .select()
      .from(clinicalResourceVersions)
      .where(eq(clinicalResourceVersions.resourceId, resourceId))
      .orderBy(desc(clinicalResourceVersions.version))
      .limit(1);
    return row ?? null;
  },

  async byId(versionId: string) {
    const [row] = await db
      .select()
      .from(clinicalResourceVersions)
      .where(eq(clinicalResourceVersions.id, versionId));
    return row ?? null;
  },

  async forPatient(patientId: string, resourceType?: string) {
    return db
      .select()
      .from(clinicalResourceVersions)
      .where(
        resourceType
          ? and(
              eq(clinicalResourceVersions.patientId, patientId),
              eq(clinicalResourceVersions.resourceType, resourceType),
            )
          : eq(clinicalResourceVersions.patientId, patientId),
      )
      .orderBy(desc(clinicalResourceVersions.sealedAt));
  },

  /** Mark a version entered-in-error (never delete). */
  async enterInError(input: {
    versionId: string;
    actorId: string;
    reason: string;
  }) {
    const [row] = await db
      .update(clinicalResourceVersions)
      .set({ lifecycleStatus: "entered_in_error", correctionReason: input.reason })
      .where(eq(clinicalResourceVersions.id, input.versionId))
      .returning();
    if (row) {
      await audit.record({
        actorId: input.actorId,
        patientId: row.patientId,
        action: "record_version.entered_in_error",
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        reason: input.reason,
        metadata: { versionId: row.id },
      });
    }
    return row;
  },
};

/* ------------------------------------------------------------------ */
/* Patient disputes                                                    */
/* ------------------------------------------------------------------ */

export const disputes = {
  /** Patient (or provider) flags a record — never rewrites attestations. */
  async raise(input: {
    patientId: string;
    raisedBy: string;
    resourceType: string;
    resourceId: string;
    reason: string;
  }) {
    if (input.reason.trim().length < 5) {
      throw new Error("Describe what is wrong so it can be reviewed.");
    }
    const [row] = await db
      .insert(dataDisputes)
      .values({
        patientId: input.patientId,
        raisedBy: input.raisedBy,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        reason: input.reason.trim(),
      })
      .returning();
    // Flag the version as disputed so UIs show a warning in critical bands.
    const [version] = await db
      .select({ id: clinicalResourceVersions.id })
      .from(clinicalResourceVersions)
      .where(eq(clinicalResourceVersions.resourceId, input.resourceId))
      .orderBy(desc(clinicalResourceVersions.version))
      .limit(1);
    if (version) {
      await db
        .update(clinicalResourceVersions)
        .set({ lifecycleStatus: "disputed" })
        .where(eq(clinicalResourceVersions.id, version.id));
    }
    await audit.record({
      actorId: input.raisedBy,
      actorRole: "patient",
      patientId: input.patientId,
      action: "record.disputed",
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      reason: input.reason.trim(),
      metadata: { disputeId: row!.id },
    });
    return row;
  },

  async openForPatient(patientId: string) {
    return db
      .select()
      .from(dataDisputes)
      .where(and(eq(dataDisputes.patientId, patientId), eq(dataDisputes.status, "open")))
      .orderBy(desc(dataDisputes.createdAt));
  },

  async resolve(input: {
    disputeId: string;
    resolvedBy: string;
    status: "resolved_disputed" | "resolved_rejected";
    notes?: string;
  }) {
    const [row] = await db
      .update(dataDisputes)
      .set({
        status: input.status,
        resolutionNotes: input.notes ?? null,
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date(),
      })
      .where(eq(dataDisputes.id, input.disputeId))
      .returning();
    if (row) {
      await audit.record({
        actorId: input.resolvedBy,
        patientId: row.patientId,
        action: "dispute.resolved",
        resourceType: "dispute",
        resourceId: row.id,
        reason: input.status,
        metadata: { notes: input.notes ?? null },
      });
    }
    return row;
  },
};
