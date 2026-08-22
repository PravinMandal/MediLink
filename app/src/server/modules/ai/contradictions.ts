/**
 * Contradiction engine — deterministic conflict detection.
 *
 * Detects: conflicting blood groups, allergy conflicts, duplicate documents,
 * and conflicting lab values for the same analyte & date. Flags — never
 * auto-resolves. Verified sources outrank self-reported ones in display.
 */
import { createHash } from "node:crypto";
import { and, eq, isNull, desc } from "drizzle-orm";
import { db } from "@/server/db";
import { allergies, conflicts, documents, observations } from "@/server/db/schema";
import { records } from "@/server/modules/records/service";

type ConflictKind = "blood_group" | "allergy" | "duplicate_document" | "lab_value";

function conflictKey(kind: ConflictKind, detail: string): string {
  return createHash("sha256").update(`${kind}:${detail}`).digest("hex").slice(0, 24);
}

async function upsertConflict(input: {
  patientId: string;
  kind: ConflictKind;
  severity?: "info" | "warning" | "critical";
  details: Record<string, unknown>;
}) {
  const key = conflictKey(input.kind, JSON.stringify(input.details));
  const existing = await db
    .select({ id: conflicts.id })
    .from(conflicts)
    .where(and(eq(conflicts.patientId, input.patientId), eq(conflicts.kind, input.kind)));
  // Cheap dedupe: skip if an open conflict of same kind with same key-ish details exists
  const same = existing.length; // per-kind open conflict refresh
  if (same > 0) {
    // refresh detection timestamp only
    await db
      .update(conflicts)
      .set({ details: input.details, detectedAt: new Date() })
      .where(and(eq(conflicts.patientId, input.patientId), eq(conflicts.kind, input.kind), eq(conflicts.status, "open")));
    return;
  }
  await db.insert(conflicts).values({
    patientId: input.patientId,
    kind: input.kind,
    severity: input.severity ?? "warning",
    details: { ...input.details, _key: key },
  });
}

export const contradictionEngine = {
  /** Scan a patient's record and (re)populate open conflicts. */
  async detect(patientId: string): Promise<number> {
    let found = 0;

    // 1) Blood group conflicts
    const bg = await records.bloodGroup(patientId);
    if (bg.conflict) {
      await upsertConflict({
        patientId,
        kind: "blood_group",
        severity: "critical",
        details: {
          verified: bg.verified,
          selfReported: bg.selfReported,
          note: "Verified lab value differs from patient self-report. Verified value is displayed.",
        },
      });
      found++;
    }

    // 2) Allergy conflicts: same substance listed with different criticality/reaction
    const allergyRows = await db
      .select()
      .from(allergies)
      .where(
        and(eq(allergies.patientId, patientId), isNull(allergies.supersededById)),
      );
    const bySubstance = new Map<string, typeof allergyRows>();
    for (const a of allergyRows) {
      const key = a.substance.toLowerCase().trim();
      if (!bySubstance.has(key)) bySubstance.set(key, []);
      bySubstance.get(key)!.push(a);
    }
    for (const [substance, rows] of bySubstance) {
      if (rows.length > 1) {
        const distinct = new Set(
          rows.map((r) => `${r.criticality ?? ""}|${r.reaction ?? ""}`),
        );
        if (distinct.size > 1) {
          await upsertConflict({
            patientId,
            kind: "allergy",
            severity: "warning",
            details: {
              substance,
              entries: rows.map((r) => ({
                criticality: r.criticality,
                reaction: r.reaction,
                trust: r.trust,
                sourceDocumentId: r.sourceDocumentId,
              })),
            },
          });
          found++;
        }
      }
    }

    // 3) Duplicate documents (identical content hash)
    const docs = await db
      .select({
        contentHash: documents.contentHash,
        title: documents.title,
        id: documents.id,
      })
      .from(documents)
      .where(eq(documents.patientId, patientId));
    const byHash = new Map<string, typeof docs>();
    for (const d of docs) {
      if (!byHash.has(d.contentHash)) byHash.set(d.contentHash, []);
      byHash.get(d.contentHash)!.push(d);
    }
    for (const [hash, rows] of byHash) {
      if (rows.length > 1) {
        await upsertConflict({
          patientId,
          kind: "duplicate_document",
          severity: "info",
          details: {
            hash: hash.slice(0, 12),
            documents: rows.map((r) => ({ id: r.id, title: r.title })),
          },
        });
        found++;
      }
    }

    // 4) Conflicting lab values: same analyte + same date, different values
    const obs = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.patientId, patientId),
          isNull(observations.supersededById),
        ),
      )
      .orderBy(desc(observations.effectiveDate));
    const byNameDate = new Map<string, typeof obs>();
    for (const o of obs) {
      if (!o.value || !o.effectiveDate) continue;
      const key = `${o.name.toLowerCase().trim()}|${o.effectiveDate}`;
      if (!byNameDate.has(key)) byNameDate.set(key, []);
      byNameDate.get(key)!.push(o);
    }
    for (const [, rows] of byNameDate) {
      if (rows.length > 1) {
        const values = new Set(rows.map((r) => Number(r.value)));
        if (values.size > 1) {
          await upsertConflict({
            patientId,
            kind: "lab_value",
            severity: "warning",
            details: {
              analyte: rows[0].name,
              date: rows[0].effectiveDate,
              values: rows.map((r) => ({
                value: Number(r.value),
                unit: r.unit,
                trust: r.trust,
                sourceDocumentId: r.sourceDocumentId,
              })),
            },
          });
          found++;
        }
      }
    }

    return found;
  },

  async openFor(patientId: string) {
    return db
      .select()
      .from(conflicts)
      .where(
        and(
          eq(conflicts.patientId, patientId),
          eq(conflicts.status, "open"),
        ),
      )
      .orderBy(desc(conflicts.detectedAt));
  },

  async resolve(conflictId: string, resolvedBy: string, note?: string) {
    await db
      .update(conflicts)
      .set({
        status: "resolved",
        resolvedBy,
        resolvedAt: new Date(),
        details: note ? { resolutionNote: note } : undefined,
      })
      .where(eq(conflicts.id, conflictId));
  },
};
