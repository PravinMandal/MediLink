/**
 * Audit service — append-only, hash-chained event log.
 *
 * Every sensitive action (view, upload, consent change, emergency access…)
 * flows through `record()`. Chaining: hash = sha256(prevHash ‖ canonical event).
 * The chain makes silent tampering detectable via `verifyChain()`.
 */
import { createHash } from "node:crypto";
import { desc, gt, sql } from "drizzle-orm";
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

/** Postgres unique-constraint violation (23505) — the chain-fork race. */
function isUniqueViolation(err: unknown): boolean {
  const code =
    (err as { code?: unknown } | null)?.code ??
    (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (code === "23505") return true;
  // PGlite/drizzle wrap driver errors; fall back to the message shape.
  const message = err instanceof Error ? err.message : String(err);
  return /duplicate key value|unique constraint/i.test(message);
}

/** PGlite has no pgcrypto: the exact undefined-function shape for digest(). */
function isMissingDigestFunction(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; cur && depth < 3; depth++) {
    const e = cur as { code?: unknown; message?: unknown; cause?: unknown };
    const message = typeof e.message === "string" ? e.message : "";
    if (
      /digest.*does not exist|does not exist.*digest|pgcrypto/i.test(message)
    ) {
      return true;
    }
    cur = e.cause;
  }
  return false;
}

export const audit = {
  async record(input: AuditInput): Promise<void> {
    const createdAtIso = new Date().toISOString();
    const metadataStr = input.metadata ? stableStringify(input.metadata) : null;
    // D7: one atomic INSERT computes seq, chains to the prior row's hash, and
    // hashes the event inside the same statement — no global advisory lock,
    // no separate SELECT-then-INSERT race window. PGlite lacks pgcrypto in
    // tests, so the fallback computes the hash in JS after reading the prior
    // row inside a transaction.
    //
    // C1: a UNIQUE index on prev_hash (migration 0002) makes a chain fork a
    // 23505; on that error we retry the statement, which re-reads the new
    // prior hash and chains correctly. Bounded retries; real errors throw.
    const raw = () => sql`
      INSERT INTO audit_events
        (actor_id, actor_role, patient_id, organization_id, action,
         resource_type, resource_id, reason, metadata, created_at,
         prev_hash, hash)
      SELECT
        ${input.actorId},
        ${input.actorRole ?? null},
        ${input.patientId ?? null},
        ${input.organizationId ?? null},
        ${input.action},
        ${input.resourceType ?? null},
        ${input.resourceId ?? null},
        ${input.reason ?? null},
        ${metadataStr}::jsonb,
        ${createdAtIso}::timestamptz,
        prev.hash,
        encode(digest(
          prev.hash || chr(31) ||
          coalesce(${input.actorId}, '') || chr(31) ||
          coalesce(${input.actorRole ?? null}, '') || chr(31) ||
          coalesce(${input.patientId ?? null}, '') || chr(31) ||
          coalesce(${input.organizationId ?? null}, '') || chr(31) ||
          ${input.action} || chr(31) ||
          coalesce(${input.resourceType ?? null}, '') || chr(31) ||
          coalesce(${input.resourceId ?? null}, '') || chr(31) ||
          coalesce(${input.reason ?? null}, '') || chr(31) ||
          coalesce(${metadataStr}, '') || chr(31) ||
          ${createdAtIso},
          'sha256'
        ), 'hex')
      FROM (
        SELECT coalesce(
          (SELECT hash FROM audit_events ORDER BY seq DESC LIMIT 1),
          'GENESIS'
        ) AS hash
      ) prev
      RETURNING seq`;
    let pgcryptoMissing = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.execute(raw());
        return;
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 2) continue; // fork race — retry
        // Only fall back when the pgcrypto digest function is unavailable
        // (PGlite in tests); real write errors must propagate. C2: match the
        // precise "function digest(...) does not exist" shape (through
        // drizzle's cause chain), not any error mentioning "function".
        if (attempt === 0 && isMissingDigestFunction(err)) {
          pgcryptoMissing = true;
          break;
        }
        throw err;
      }
    }
    if (!pgcryptoMissing) return; // exhausted retries on unique violations

    // PGlite fallback (no pgcrypto): read + hash + insert inside one
    // transaction, retried on prev_hash unique violations the same way.
    for (let attempt = 0; ; attempt++) {
      try {
        await db.transaction(async (tx) => {
          const [last] = await tx
            .select({ hash: auditEvents.hash })
            .from(auditEvents)
            .orderBy(desc(auditEvents.seq))
            .limit(1);
          const prevHash = last?.hash ?? "GENESIS";
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
            metadataStr,
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
        return;
      } catch (err) {
        if (attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  },

  async forPatient(patientId: string, limit = 100) {
    return db
      .select()
      .from(auditEvents)
      .where(sql`${auditEvents.patientId} = ${patientId}`)
      .orderBy(desc(auditEvents.seq))
      .limit(limit);
  },

  async countForPatient(patientId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(sql`${auditEvents.patientId} = ${patientId}`);
    return row?.count ?? 0;
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

  /**
   * Recompute the chain; returns the first broken sequence number or null.
   * Streams in chunks ordered by seq so a large audit log doesn't need to fit
   * in memory (serverless memory limits). Tamper-detection semantics are
   * identical to a full scan: seq order is the chain order.
   */
  async verifyChain(chunkSize = 500): Promise<number | null> {
    let prevHash = "GENESIS";
    let cursor = 0;
    for (;;) {
      const rows = await db
        .select({
          seq: auditEvents.seq,
          prevHash: auditEvents.prevHash,
          hash: auditEvents.hash,
          actorId: auditEvents.actorId,
          actorRole: auditEvents.actorRole,
          patientId: auditEvents.patientId,
          organizationId: auditEvents.organizationId,
          action: auditEvents.action,
          resourceType: auditEvents.resourceType,
          resourceId: auditEvents.resourceId,
          reason: auditEvents.reason,
          metadata: auditEvents.metadata,
          createdAt: auditEvents.createdAt,
        })
        .from(auditEvents)
        .where(gt(auditEvents.seq, cursor))
        .orderBy(auditEvents.seq)
        .limit(chunkSize);
      if (rows.length === 0) return null;
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
        cursor = row.seq;
      }
    }
  },
};
