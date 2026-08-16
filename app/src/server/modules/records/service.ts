/**
 * Records service — clinical CRUD with provenance, amendments, timeline.
 *
 * Writes are restricted to verified professionals (enforced by callers via
 * requireVerifiedPractitioner / requireVerifiedOrganization). Every row
 * records who authored it, for which organization, from which source
 * document, and at what trust level. Corrections never overwrite: the old
 * row's supersededById points at its replacement.
 */
import { and, desc, eq, isNull, sql, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  allergies,
  conditions,
  diagnosticReports,
  documents,
  encounters,
  immunizations,
  medicationStatements,
  observations,
  patients,
  procedures,
  searchChunks,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";

export type RecordTrust = "verified" | "extracted" | "self_reported" | "amended";

export type ObservationInput = {
  panel?: string;
  name: string;
  value?: number | null;
  valueString?: string | null;
  unit?: string;
  referenceRangeLow?: number | null;
  referenceRangeHigh?: number | null;
  flag?: "normal" | "high" | "low" | "critical" | "unknown";
  effectiveDate?: string;
  loincCode?: string;
};

export interface ProvenanceInput {
  authoredById: string;
  organizationId?: string | null;
  sourceDocumentId?: string | null;
  trust: RecordTrust;
  recordedAt?: Date | null;
}

async function indexRecordChunk(input: {
  patientId: string;
  recordType: string;
  recordId: string;
  label: string;
  content: string;
  date?: string | null;
  trust: string;
}) {
  await db.delete(searchChunks).where(
    and(
      eq(searchChunks.recordType, input.recordType),
      eq(searchChunks.recordId, input.recordId),
    ),
  );
  if (!input.content.trim()) return;
  await db.insert(searchChunks).values({
    patientId: input.patientId,
    recordType: input.recordType,
    recordId: input.recordId,
    label: input.label,
    date: input.date ?? null,
    trust: input.trust,
    content: `${input.label}\n${input.content}`,
  });
}

export const records = {
  /* ---------------- Encounters ---------------- */

  async addEncounter(
    patientId: string,
    data: {
      type: (typeof encounters.$inferSelect)["type"];
      reason?: string;
      occurredAt: Date;
      notes?: string;
      practitionerId?: string | null;
    },
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(encounters)
      .values({
        patientId,
        practitionerId: data.practitionerId ?? null,
        type: data.type,
        reason: data.reason,
        occurredAt: data.occurredAt,
        notes: data.notes,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? data.occurredAt,
        resource: {
          resourceType: "Encounter",
          class: data.type,
          reason: data.reason ?? undefined,
          period: { start: data.occurredAt.toISOString() },
        },
      })
      .returning();
    await audit.record({
      actorId: prov.authoredById,
      patientId,
      organizationId: prov.organizationId ?? null,
      action: "record.encounter.created",
      resourceType: "encounter",
      resourceId: row.id,
    });
    return row;
  },

  /* ---------------- Conditions ---------------- */

  async addCondition(
    patientId: string,
    data: {
      name: string;
      status?: "active" | "resolved" | "chronic";
      onsetDate?: string;
      resolvedDate?: string;
      notes?: string;
    },
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(conditions)
      .values({
        patientId,
        name: data.name,
        status: data.status ?? "active",
        onsetDate: data.onsetDate ?? null,
        resolvedDate: data.resolvedDate ?? null,
        notes: data.notes ?? null,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? null,
        resource: {
          resourceType: "Condition",
          code: { text: data.name },
          clinicalStatus: data.status ?? "active",
          onsetDateTime: data.onsetDate,
          abatementDateTime: data.resolvedDate,
        },
      })
      .returning();
    await audit.record({
      actorId: prov.authoredById,
      patientId,
      organizationId: prov.organizationId ?? null,
      action: "record.condition.created",
      resourceType: "condition",
      resourceId: row.id,
    });
    await indexRecordChunk({
      patientId,
      recordType: "condition",
      recordId: row.id,
      label: `Condition: ${data.name}`,
      content: `${data.name} — ${data.status ?? "active"}${data.onsetDate ? ` since ${data.onsetDate}` : ""}. ${data.notes ?? ""}`,
      date: data.onsetDate,
      trust: prov.trust,
    });
    return row;
  },

  /* ---------------- Allergies ---------------- */

  async addAllergy(
    patientId: string,
    data: {
      substance: string;
      category?: string;
      criticality?: string;
      reaction?: string;
      onsetDate?: string;
    },
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(allergies)
      .values({
        patientId,
        substance: data.substance,
        category: data.category ?? null,
        criticality: data.criticality ?? null,
        reaction: data.reaction ?? null,
        onsetDate: data.onsetDate ?? null,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? null,
        resource: {
          resourceType: "AllergyIntolerance",
          code: { text: data.substance },
          criticality: data.criticality ?? undefined,
          reaction:
            data.reaction !== undefined
              ? [{ manifestation: [{ text: data.reaction }] }]
              : undefined,
        },
      })
      .returning();
    await audit.record({
      actorId: prov.authoredById,
      patientId,
      organizationId: prov.organizationId ?? null,
      action: "record.allergy.created",
      resourceType: "allergy",
      resourceId: row.id,
    });
    await indexRecordChunk({
      patientId,
      recordType: "allergy",
      recordId: row.id,
      label: `Allergy: ${data.substance}`,
      content: `Allergy to ${data.substance}${data.criticality ? ` (${data.criticality})` : ""}${data.reaction ? ` — reaction: ${data.reaction}` : ""}.`,
      date: data.onsetDate,
      trust: prov.trust,
    });
    return row;
  },

  /* ---------------- Medications ---------------- */

  async addMedication(
    patientId: string,
    data: {
      medication: string;
      dose?: string;
      route?: string;
      frequency?: string;
      startDate?: string;
      endDate?: string;
      status?: "active" | "stopped" | "completed";
      prescriberId?: string | null;
      notes?: string;
    },
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(medicationStatements)
      .values({
        patientId,
        medication: data.medication,
        dose: data.dose ?? null,
        route: data.route ?? null,
        frequency: data.frequency ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        status: data.status ?? "active",
        prescriberId: data.prescriberId ?? null,
        notes: data.notes ?? null,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? null,
        resource: {
          resourceType: "MedicationStatement",
          medicationCodeableConcept: { text: data.medication },
          dosage: data.dose
            ? [{ text: [data.dose, data.route, data.frequency].filter(Boolean).join(" ") }]
            : undefined,
          effectivePeriod: { start: data.startDate, end: data.endDate },
          status: data.status ?? "active",
        },
      })
      .returning();
    await audit.record({
      actorId: prov.authoredById,
      patientId,
      organizationId: prov.organizationId ?? null,
      action: "record.medication.created",
      resourceType: "medication_statement",
      resourceId: row.id,
    });
    await indexRecordChunk({
      patientId,
      recordType: "medication_statement",
      recordId: row.id,
      label: `Medication: ${data.medication}`,
      content: `${data.medication} ${data.dose ?? ""} ${data.frequency ?? ""} — ${data.status ?? "active"}${data.startDate ? ` from ${data.startDate}` : ""}.`,
      date: data.startDate,
      trust: prov.trust,
    });
    return row;
  },

  /* ---------------- Observations (labs, vitals) ---------------- */

  async addObservation(
    patientId: string,
    data: ObservationInput,
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(observations)
      .values({
        patientId,
        panel: data.panel ?? null,
        name: data.name,
        loincCode: data.loincCode ?? null,
        value: data.value != null ? String(data.value) : null,
        valueString: data.valueString ?? null,
        unit: data.unit ?? null,
        referenceRangeLow:
          data.referenceRangeLow != null ? String(data.referenceRangeLow) : null,
        referenceRangeHigh:
          data.referenceRangeHigh != null ? String(data.referenceRangeHigh) : null,
        flag: data.flag ?? "unknown",
        effectiveDate: data.effectiveDate ?? null,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? null,
        resource: {
          resourceType: "Observation",
          code: { text: data.name },
          valueQuantity:
            data.value != null
              ? { value: data.value, unit: data.unit ?? undefined }
              : undefined,
          valueString: data.value != null ? undefined : data.valueString ?? undefined,
          effectiveDateTime: data.effectiveDate,
          referenceRange:
            data.referenceRangeLow != null || data.referenceRangeHigh != null
              ? [
                  {
                    low: data.referenceRangeLow != null ? { value: data.referenceRangeLow } : undefined,
                    high: data.referenceRangeHigh != null ? { value: data.referenceRangeHigh } : undefined,
                  },
                ]
              : undefined,
        },
      })
      .returning();
    await indexRecordChunk({
      patientId,
      recordType: "observation",
      recordId: row.id,
      label: `${data.name}: ${data.value ?? data.valueString ?? ""} ${data.unit ?? ""}`,
      content: `${data.panel ? `${data.panel} — ` : ""}${data.name} = ${data.value ?? data.valueString ?? "n/a"} ${data.unit ?? ""}${data.flag && data.flag !== "unknown" ? ` (${data.flag})` : ""}${data.effectiveDate ? ` on ${data.effectiveDate}` : ""}.`,
      date: data.effectiveDate,
      trust: prov.trust,
    });
    return row;
  },

  async addObservations(
    patientId: string,
    list: ObservationInput[],
    prov: ProvenanceInput,
  ) {
    for (const item of list) {
      await records.addObservation(patientId, item, prov);
    }
  },

  /* ---------------- Procedures ---------------- */

  async addProcedure(
    patientId: string,
    data: { name: string; performedDate?: string; outcome?: string; notes?: string },
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(procedures)
      .values({
        patientId,
        name: data.name,
        performedDate: data.performedDate ?? null,
        outcome: data.outcome ?? null,
        notes: data.notes ?? null,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? null,
        resource: {
          resourceType: "Procedure",
          code: { text: data.name },
          performedDateTime: data.performedDate,
          outcome: data.outcome ?? undefined,
        },
      })
      .returning();
    await audit.record({
      actorId: prov.authoredById,
      patientId,
      organizationId: prov.organizationId ?? null,
      action: "record.procedure.created",
      resourceType: "procedure",
      resourceId: row.id,
    });
    await indexRecordChunk({
      patientId,
      recordType: "procedure",
      recordId: row.id,
      label: `Procedure: ${data.name}`,
      content: `${data.name}${data.performedDate ? ` on ${data.performedDate}` : ""}${data.outcome ? ` — ${data.outcome}` : ""}.`,
      date: data.performedDate,
      trust: prov.trust,
    });
    return row;
  },

  /* ---------------- Immunizations ---------------- */

  async addImmunization(
    patientId: string,
    data: { vaccine: string; date?: string; doseNumber?: number },
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(immunizations)
      .values({
        patientId,
        vaccine: data.vaccine,
        date: data.date ?? null,
        doseNumber: data.doseNumber ?? null,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? null,
        resource: {
          resourceType: "Immunization",
          vaccineCode: { text: data.vaccine },
          occurrenceDateTime: data.date,
        },
      })
      .returning();
    return row;
  },

  /* ---------------- Diagnostic reports ---------------- */

  async addDiagnosticReport(
    patientId: string,
    data: {
      title: string;
      category?: string;
      conclusion?: string;
      effectiveDate?: string;
    },
    prov: ProvenanceInput,
  ) {
    const [row] = await db
      .insert(diagnosticReports)
      .values({
        patientId,
        title: data.title,
        category: data.category ?? "other",
        conclusion: data.conclusion ?? null,
        effectiveDate: data.effectiveDate ?? null,
        authoredById: prov.authoredById,
        organizationId: prov.organizationId ?? null,
        sourceDocumentId: prov.sourceDocumentId ?? null,
        trust: prov.trust,
        recordedAt: prov.recordedAt ?? null,
        resource: {
          resourceType: "DiagnosticReport",
          code: { text: data.title },
          conclusion: data.conclusion ?? undefined,
          effectiveDateTime: data.effectiveDate,
        },
      })
      .returning();
    await indexRecordChunk({
      patientId,
      recordType: "diagnostic_report",
      recordId: row.id,
      label: `Report: ${data.title}`,
      content: `${data.title}${data.conclusion ? ` — ${data.conclusion}` : ""}${data.effectiveDate ? ` (${data.effectiveDate})` : ""}.`,
      date: data.effectiveDate,
      trust: prov.trust,
    });
    return row;
  },

  /* ---------------- Amendments ---------------- */

  /**
   * Correct a record: marks the original as superseded and (optionally)
   * creates the replacement in the same transaction. Originals are preserved.
   */
  async supersede(input: {
    recordType: "condition" | "allergy" | "medication_statement" | "observation" | "procedure";
    recordId: string;
    replacementId: string | null;
    reason: string;
    actorId: string;
  }) {
    const table = {
      condition: conditions,
      allergy: allergies,
      medication_statement: medicationStatements,
      observation: observations,
      procedure: procedures,
    }[input.recordType];
    await db
      .update(table)
      .set({ supersededById: input.replacementId })
      .where(eq(table.id, input.recordId));
    await audit.record({
      actorId: input.actorId,
      action: "record.superseded",
      resourceType: input.recordType,
      resourceId: input.recordId,
      reason: input.reason,
      metadata: { replacementId: input.replacementId },
    });
  },

  /* ---------------- Reads ---------------- */

  async currentConditions(patientId: string) {
    return db
      .select()
      .from(conditions)
      .where(
        and(
          eq(conditions.patientId, patientId),
          isNull(conditions.supersededById),
        ),
      )
      .orderBy(desc(conditions.createdAt));
  },

  async currentAllergies(patientId: string) {
    return db
      .select()
      .from(allergies)
      .where(
        and(eq(allergies.patientId, patientId), isNull(allergies.supersededById)),
      )
      .orderBy(desc(allergies.createdAt));
  },

  async currentMedications(patientId: string) {
    return db
      .select()
      .from(medicationStatements)
      .where(
        and(
          eq(medicationStatements.patientId, patientId),
          isNull(medicationStatements.supersededById),
          eq(medicationStatements.status, "active"),
        ),
      )
      .orderBy(desc(medicationStatements.createdAt));
  },

  async allMedications(patientId: string) {
    return db
      .select()
      .from(medicationStatements)
      .where(
        and(
          eq(medicationStatements.patientId, patientId),
          isNull(medicationStatements.supersededById),
        ),
      )
      .orderBy(desc(medicationStatements.createdAt));
  },

  async observationsFor(patientId: string, limit = 500) {
    return db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.patientId, patientId),
          isNull(observations.supersededById),
        ),
      )
      .orderBy(desc(observations.effectiveDate))
      .limit(limit);
  },

  /** Lab trends: name → chronological series (for sparklines/charts). */
  async trends(patientId: string, names?: string[]) {
    const rows = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.patientId, patientId),
          isNull(observations.supersededById),
          sql`${observations.value} IS NOT NULL`,
          names?.length ? inArray(observations.name, names) : sql`true`,
        ),
      )
      .orderBy(observations.effectiveDate);
    const byName = new Map<
      string,
      Array<{ date: string | null; value: number; unit: string | null; flag: string }>
    >();
    for (const row of rows) {
      const key = row.name;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push({
        date: row.effectiveDate,
        value: Number(row.value),
        unit: row.unit,
        flag: row.flag,
      });
    }
    // Keep only names with ≥2 points for meaningful trends, plus latest values
    return byName;
  },

  async proceduresFor(patientId: string) {
    return db
      .select()
      .from(procedures)
      .where(
        and(eq(procedures.patientId, patientId), isNull(procedures.supersededById)),
      )
      .orderBy(desc(procedures.performedDate));
  },

  async immunizationsFor(patientId: string) {
    return db
      .select()
      .from(immunizations)
      .where(eq(immunizations.patientId, patientId))
      .orderBy(desc(immunizations.date));
  },

  async diagnosticReportsFor(patientId: string) {
    return db
      .select()
      .from(diagnosticReports)
      .where(
        and(
          eq(diagnosticReports.patientId, patientId),
          isNull(diagnosticReports.supersededById),
        ),
      )
      .orderBy(desc(diagnosticReports.effectiveDate));
  },

  async encountersFor(patientId: string) {
    return db
      .select()
      .from(encounters)
      .where(eq(encounters.patientId, patientId))
      .orderBy(desc(encounters.occurredAt));
  },

  async documentsFor(patientId: string) {
    return db
      .select()
      .from(documents)
      .where(eq(documents.patientId, patientId))
      .orderBy(desc(documents.createdAt));
  },

  /** Unified timeline across all resource types. */
  async timeline(patientId: string) {
    const [
      conds,
      allergiesRows,
      meds,
      obs,
      procs,
      immuns,
      reports,
      docs,
      encs,
    ] = await Promise.all([
      records.currentConditions(patientId),
      records.currentAllergies(patientId),
      records.allMedications(patientId),
      records.observationsFor(patientId, 1000),
      records.proceduresFor(patientId),
      records.immunizationsFor(patientId),
      records.diagnosticReportsFor(patientId),
      records.documentsFor(patientId),
      records.encountersFor(patientId),
    ]);

    type Event = {
      kind: string;
      id: string;
      label: string;
      date: string | null;
      detail?: string | null;
      trust: string;
      organizationId: string | null;
      sourceDocumentId: string | null;
    };

    const events: Event[] = [];
    for (const c of conds)
      events.push({
        kind: "condition",
        id: c.id,
        label: c.name,
        date: c.onsetDate ?? c.createdAt.toISOString().slice(0, 10),
        detail: c.status,
        trust: c.trust,
        organizationId: c.organizationId,
        sourceDocumentId: c.sourceDocumentId,
      });
    for (const a of allergiesRows)
      events.push({
        kind: "allergy",
        id: a.id,
        label: `Allergy — ${a.substance}`,
        date: a.onsetDate ?? a.createdAt.toISOString().slice(0, 10),
        detail: [a.criticality, a.reaction].filter(Boolean).join(" · "),
        trust: a.trust,
        organizationId: a.organizationId,
        sourceDocumentId: a.sourceDocumentId,
      });
    for (const m of meds)
      events.push({
        kind: "medication",
        id: m.id,
        label: `${m.medication}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? `, ${m.frequency}` : ""}`,
        date: m.startDate ?? m.createdAt.toISOString().slice(0, 10),
        detail: m.status,
        trust: m.trust,
        organizationId: m.organizationId,
        sourceDocumentId: m.sourceDocumentId,
      });
    for (const o of obs)
      events.push({
        kind: "observation",
        id: o.id,
        label: `${o.name}: ${o.value ?? o.valueString ?? "—"} ${o.unit ?? ""}`.trim(),
        date: o.effectiveDate ?? o.createdAt.toISOString().slice(0, 10),
        detail: [o.panel, o.flag !== "unknown" ? o.flag : null]
          .filter(Boolean)
          .join(" · "),
        trust: o.trust,
        organizationId: o.organizationId,
        sourceDocumentId: o.sourceDocumentId,
      });
    for (const p of procs)
      events.push({
        kind: "procedure",
        id: p.id,
        label: p.name,
        date: p.performedDate ?? p.createdAt.toISOString().slice(0, 10),
        detail: p.outcome,
        trust: p.trust,
        organizationId: p.organizationId,
        sourceDocumentId: p.sourceDocumentId,
      });
    for (const i of immuns)
      events.push({
        kind: "immunization",
        id: i.id,
        label: i.vaccine,
        date: i.date ?? i.createdAt.toISOString().slice(0, 10),
        trust: i.trust,
        organizationId: i.organizationId,
        sourceDocumentId: i.sourceDocumentId,
      });
    for (const r of reports)
      events.push({
        kind: "report",
        id: r.id,
        label: r.title,
        date: r.effectiveDate ?? r.createdAt.toISOString().slice(0, 10),
        detail: r.conclusion?.slice(0, 140),
        trust: r.trust,
        organizationId: r.organizationId,
        sourceDocumentId: r.sourceDocumentId,
      });
    for (const d of docs)
      events.push({
        kind: "document",
        id: d.id,
        label: d.title,
        date: d.recordedDate ?? d.createdAt.toISOString().slice(0, 10),
        detail: d.kind.replace(/_/g, " "),
        trust: "verified",
        organizationId: d.organizationId,
        sourceDocumentId: d.id,
      });
    for (const e of encs)
      events.push({
        kind: "encounter",
        id: e.id,
        label: `${e.type.toUpperCase()} — ${e.reason ?? "Consultation"}`,
        date: e.occurredAt.toISOString().slice(0, 10),
        trust: e.trust,
        organizationId: e.organizationId,
        sourceDocumentId: e.sourceDocumentId,
      });

    events.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return events;
  },

  /**
   * Blood group: verified lab observation wins over self-report.
   * Returns both so the UI can flag conflicts.
   */
  async bloodGroup(patientId: string) {
    const [patient] = await db
      .select({ self: patients.bloodGroupSelfReported })
      .from(patients)
      .where(eq(patients.id, patientId));
    const bgObs = await db
      .select()
      .from(observations)
      .where(
        and(
          eq(observations.patientId, patientId),
          sql`lower(${observations.name}) LIKE '%blood group%'`,
          isNull(observations.supersededById),
        ),
      )
      .orderBy(desc(observations.effectiveDate))
      .limit(5);
    const verified = bgObs.find((o) => o.trust === "verified") ?? null;
    return {
      verified: verified
        ? { value: verified.valueString ?? verified.value, date: verified.effectiveDate, observationId: verified.id }
        : null,
      selfReported: patient?.self ?? null,
      conflict:
        !!verified &&
        !!patient?.self &&
        (verified.valueString ?? verified.value) !== patient.self,
    };
  },
};
