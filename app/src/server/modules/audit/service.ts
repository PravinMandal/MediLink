/**
 * Audit service — append-only, hash-chained event log.
 *
 * Every sensitive action (view, upload, consent change, emergency access…)
 * flows through `record()`. Chaining: hash = sha256(prevHash ‖ canonical event).
 * The chain makes silent tampering detectable via `verifyChain()`.
 */
import { createHash } from "node:crypto";
import { desc, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { auditEvents } from "@/server/db/schema";

export interface AuditInput {
  actorId: string | null;
  actorRole?: string | null;
  patientId?: string | null;
  organizationId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Deterministic JSON so the chain is reproducible. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

function eventHash(
  prevHash: string,
  actorId: string | null,
  actorRole: string | null,
  patientId: string | null,
  organizationId: string | null,
  action: string,
  resourceType: string | null,
  resourceId: string | null,
  reason: string | null,
  metadata: string | null,
  createdAtIso: string,
): string {
  return createHash("sha256")
    .update(
      [
        prevHash,
        actorId ?? "",
        actorRole ?? "",
        patientId ?? "",
        organizationId ?? "",
        action,
        resourceType ?? "",
        resourceId ?? "",
        reason ?? "",
        metadata ?? "",
        createdAtIso,
      ].join("\u001f"),
    )
    .digest("hex");
}

export const audit = {
  async record(input: AuditInput): Promise<void> {
    const createdAtIso = new Date().toISOString();
    await db.transaction(async (tx) => {
      // Serialize chain appends — one writer at a time.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(918273645)`);
      const [last] = await tx
        .select({ hash: auditEvents.hash })
        .from(auditEvents)
        .orderBy(desc(auditEvents.seq))
        .limit(1);
      const prevHash = last?.hash ?? "GENESIS";
      const metadata = input.metadata
        ? stableStringify(input.metadata)
        : null;
      const hash = eventHash(
        prevHash,
        input.actorId,
        input.actorRole ?? null,
        input.patientId ?? null,
        input.organizationId ?? null,
        input.action,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.reason ?? null,
        metadata,
        createdAtIso,
      );
      await tx.insert(auditEvents).values({
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        patientId: input.patientId ?? null,
        organizationId: input.organizationId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata ?? null,
        createdAt: new Date(createdAtIso),
        prevHash,
        hash,
      });
    });
  },

  async forPatient(patientId: string, limit = 100) {
    return db
      .select()
      .from(auditEvents)
      .where(sql`${auditEvents.patientId} = ${patientId}`)
      .orderBy(desc(auditEvents.seq))
      .limit(limit);
  },

  async forActor(actorId: string, limit = 100) {
    return db
      .select()
      .from(auditEvents)
      .where(sql`${auditEvents.actorId} = ${actorId}`)
      .orderBy(desc(auditEvents.seq))
      .limit(limit);
  },

  async recent(limit = 200) {
    return db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.seq))
      .limit(limit);
  },

  /** Recompute the chain; returns the first broken sequence number or null. */
  async verifyChain(): Promise<number | null> {
    const rows = await db
      .select()
      .from(auditEvents)
      .orderBy(auditEvents.seq);
    let prevHash = "GENESIS";
    for (const row of rows) {
      if (row.prevHash !== prevHash) return row.seq;
      const expected = eventHash(
        prevHash,
        row.actorId,
        row.actorRole,
        row.patientId,
        row.organizationId,
        row.action,
        row.resourceType,
        row.resourceId,
        row.reason,
        row.metadata ? stableStringify(row.metadata) : null,
        row.createdAt.toISOString(),
      );
      if (expected !== row.hash) return row.seq;
      prevHash = row.hash;
    }
    return null;
  },
};
