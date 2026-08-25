/**
 * Provenance view-model for the ProvenanceDrawer / EvidenceChip
 * (BuildPlan §4.1 trust model, §7.5, Backlog D).
 *
 * Aggregates, for one patient, everything the drawer shows per clinical row:
 * record-versions (hash, review state, lifecycle, history), source document
 * (title, page refs, content hash), author/org names, and open disputes.
 * Pages already enforce access before calling in — this module only reads.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  documents,
  organizations,
  user as userTable,
  type ClinicalResourceVersion,
  type DataDispute,
} from "@/server/db/schema";
import { recordVersions, disputes } from "./versions";

export type ProvenanceRow = {
  resourceId: string;
  resourceType: string;
  /** "Derived from CBC report, page 1" when a source document exists. */
  sourceLine: string | null;
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  authorName: string | null;
  organizationName: string | null;
  /** Review state in words, per §4.1. */
  reviewText: string;
  /** Lifecycle in words, per §7.3/§7.10. */
  lifecycleText: string | null;
  /** Payload hash fragment (record version), else document content hash. */
  hashFragment: string | null;
  version: {
    versionId: string;
    version: number;
    lifecycleStatus: string;
    correctionReason: string | null;
    sealedAt: string;
  } | null;
  /** Linked version history (newest first) when versions exist. */
  history: Array<{
    versionId: string;
    version: number;
    lifecycleStatus: string;
    correctionReason: string | null;
    reviewState: string;
    sealedAt: string;
    replacesVersionId: string | null;
  }>;
  disputed: boolean;
};

const REVIEW_TEXT: Record<string, string> = {
  machine_extracted:
    "Machine-extracted from the original report; not yet reviewed by a lab professional",
  human_reviewed: "Reviewed by a human contributor",
  attested: "Attested by the contributor",
  not_required: "Entered directly by a contributor",
};

const LIFECYCLE_TEXT: Record<string, (d?: string) => string> = {
  corrected: (d) => `Corrected${d ? ` on ${d}` : ""}`,
  superseded: (d) => `Superseded${d ? ` on ${d}` : ""} — a linked correction replaced this version`,
  entered_in_error: () => "Entered in error — kept for the audit trail, not clinical use",
  disputed: () => "Disputed — under review",
};

function dayLabel(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function mapVersion(v: ClinicalResourceVersion) {
  return {
    versionId: v.id,
    version: v.version,
    lifecycleStatus: v.lifecycleStatus,
    correctionReason: v.correctionReason,
    reviewState: v.reviewState,
    sealedAt: v.sealedAt.toISOString(),
    replacesVersionId: v.replacesVersionId,
  };
}

export const provenance = {
  /**
   * Build drawer data for a patient's clinical rows in one batched call:
   * one versions query, one documents query, one dispute query, plus
   * name lookups for the distinct authors/orgs found.
   */
  async forPatient(
    patientId: string,
  ): Promise<Map<string, ProvenanceRow>> {
    const [versions, openDisputes] = await Promise.all([
      recordVersions.forPatient(patientId),
      disputes.openForPatient(patientId),
    ]);

    // Group versions by resource; newest first is already the service order.
    const byResource = new Map<string, ClinicalResourceVersion[]>();
    for (const v of versions) {
      if (!byResource.has(v.resourceId)) byResource.set(v.resourceId, []);
      byResource.get(v.resourceId)!.push(v);
    }

    // Distinct authors + orgs + source documents for name/title lookups.
    const authorIds = [...new Set(versions.map((v) => v.authoredById).filter((x): x is string => !!x))];
    const orgIds = [...new Set(versions.map((v) => v.organizationId).filter((x): x is string => !!x))];
    const docIds = [
      ...new Set(versions.map((v) => v.sourceDocumentId).filter((x): x is string => !!x)),
    ];
    const docRows = docIds.length
      ? await db
          .select({
            id: documents.id,
            title: documents.title,
            contentHash: documents.contentHash,
          })
          .from(documents)
          .where(inArray(documents.id, docIds))
      : [];
    const [authorRows, orgRows] = await Promise.all([
      authorIds.length
        ? db
            .select({ id: userTable.id, name: userTable.name })
            .from(userTable)
            .where(inArray(userTable.id, authorIds))
        : Promise.resolve([] as Array<{ id: string; name: string }>),
      orgIds.length
        ? db
            .select({ id: organizations.id, name: organizations.name })
            .from(organizations)
            .where(inArray(organizations.id, orgIds))
        : Promise.resolve([] as Array<{ id: string; name: string }>),
    ]);
    const authorName = new Map(authorRows.map((a) => [a.id, a.name]));
    const orgName = new Map(orgRows.map((o) => [o.id, o.name]));
    const docById = new Map(docRows.map((d) => [d.id, d]));
    const disputedResourceIds = new Set(openDisputes.map((d: DataDispute) => d.resourceId));

    const rows = new Map<string, ProvenanceRow>();
    for (const [resourceId, vs] of byResource) {
      const current = vs[0]!;
      const doc = current.sourceDocumentId ? docById.get(current.sourceDocumentId) : undefined;
      const pages = current.pageRefs?.map((p) => p.page) ?? [];
      const sourceLine = doc
        ? `Derived from ${doc.title}${pages.length ? `, page ${[...new Set(pages)].join(", ")}` : ""}`
        : null;
      const lifecycleFn = LIFECYCLE_TEXT[current.lifecycleStatus];
      rows.set(resourceId, {
        resourceId,
        resourceType: current.resourceType,
        sourceLine,
        sourceDocumentId: current.sourceDocumentId,
        sourceDocumentTitle: doc?.title ?? null,
        authorName: current.authoredById ? authorName.get(current.authoredById) ?? null : null,
        organizationName: current.organizationId
          ? orgName.get(current.organizationId) ?? null
          : null,
        reviewText:
          REVIEW_TEXT[current.reviewState] ?? REVIEW_TEXT.not_required!,
        lifecycleText: current.lifecycleStatus === "active" && disputedResourceIds.has(resourceId)
          ? LIFECYCLE_TEXT.disputed!()
          : lifecycleFn
            ? lifecycleFn(dayLabel(current.sealedAt))
            : null,
        hashFragment: current.payloadSha256?.slice(0, 16) ?? doc?.contentHash.slice(0, 16) ?? null,
        version: {
          versionId: current.id,
          version: current.version,
          lifecycleStatus: current.lifecycleStatus,
          correctionReason: current.correctionReason,
          sealedAt: current.sealedAt.toISOString(),
        },
        history: vs.map(mapVersion),
        disputed: disputedResourceIds.has(resourceId),
      });
    }
    return rows;
  },

  /**
   * Fallback data for rows without a sealed version: use the row's own
   * provenance columns (trust/author/org/document). Author + document names
   * are resolved so the drawer can still say where the fact came from.
   */
  async fallbackFor(input: {
    resourceId: string;
    resourceType: string;
    trust: string;
    sourceDocumentId: string | null;
    authoredById: string | null;
    organizationId: string | null;
    disputed?: boolean;
  }): Promise<ProvenanceRow> {
    const [doc] = input.sourceDocumentId
      ? await db
          .select({
            title: documents.title,
            contentHash: documents.contentHash,
          })
          .from(documents)
          .where(eq(documents.id, input.sourceDocumentId))
      : [];
    let authorName: string | null = null;
    if (input.authoredById) {
      const [a] = await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, input.authoredById));
      authorName = a?.name ?? null;
    }
    let orgName: string | null = null;
    if (input.organizationId) {
      const [o] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId));
      orgName = o?.name ?? null;
    }
    return {
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      sourceLine: doc ? `Derived from ${doc.title}` : null,
      sourceDocumentId: input.sourceDocumentId,
      sourceDocumentTitle: doc?.title ?? null,
      authorName,
      organizationName: orgName,
      reviewText:
        input.trust === "extracted"
          ? REVIEW_TEXT.machine_extracted!
          : input.trust === "self_reported"
            ? "Patient-reported — not clinically reviewed"
            : REVIEW_TEXT.not_required!,
      lifecycleText: null,
      hashFragment: doc ? doc.contentHash.slice(0, 16) : null,
      version: null,
      history: [],
      disputed: input.disputed ?? false,
    };
  },
};
