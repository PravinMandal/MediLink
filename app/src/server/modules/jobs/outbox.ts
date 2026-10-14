/**
 * Transactional outbox + durable idempotent jobs (BuildPlan §9.1, §9.4, Backlog C).
 *
 * Business events are committed to `outbox_events` in the same transaction as
 * the originating write (callers pass a tx where possible). `drainOutbox`
 * processes pending events with handler registration by type; failures are
 * retried with backoff and dead-letter via `job_runs`.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { outboxEvents, jobRuns } from "@/server/db/schema";

type OutboxHandler = (payload: Record<string, unknown>) => Promise<void>;
const handlers = new Map<string, OutboxHandler>();

export function registerOutboxHandler(type: string, handler: OutboxHandler) {
  handlers.set(type, handler);
}

export const outbox = {
  /** Enqueue an event (call inside the business transaction when possible). */
  async publish(input: {
    aggregateType: string;
    aggregateId: string;
    type: string;
    payload: Record<string, unknown>;
    tx?: Pick<typeof db, "insert">;
  }) {
    const executor = input.tx ?? db;
    await executor.insert(outboxEvents).values({
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      type: input.type,
      payload: input.payload,
    });
  },

  /** Process pending outbox events once. Idempotent; safe to call on a timer. */
  async drain(limit = 20): Promise<{ processed: number; failed: number }> {
    const pending = await db
      .select()
      .from(outboxEvents)
      .where(isNull(outboxEvents.processedAt))
      .orderBy(outboxEvents.seq)
      .limit(limit);
    let processed = 0;
    let failed = 0;
    for (const event of pending) {
      const handler = handlers.get(event.type);
      if (!handler) {
        // No handler registered (e.g., in tests): dead-letter, never mark
        // processed — an event published before its handler exists must not
        // be silently discarded.
        await db
          .update(outboxEvents)
          .set({ attempts: event.attempts + 1, lastError: "no handler registered" })
          .where(eq(outboxEvents.seq, event.seq));
        failed++;
        continue;
      }
      try {
        await handler(event.payload as Record<string, unknown>);
        await db
          .update(outboxEvents)
          .set({ processedAt: new Date() })
          .where(eq(outboxEvents.seq, event.seq));
        processed++;
      } catch (err) {
        failed++;
        const attempts = event.attempts + 1;
        await db
          .update(outboxEvents)
          .set({
            attempts,
            lastError: String(err).slice(0, 500),
            processedAt: attempts >= 10 ? new Date() : null, // dead-letter at 10
          })
          .where(eq(outboxEvents.seq, event.seq));
      }
    }
    return { processed, failed };
  },
};

/* ------------------------------------------------------------------ */
/* Durable job runs                                                    */
/* ------------------------------------------------------------------ */

type JobHandler = (payload: Record<string, unknown>, jobId: string) => Promise<Record<string, unknown> | void>;
const jobHandlers = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler) {
  jobHandlers.set(jobType, handler);
}

export const jobs = {
  /** Enqueue a durable job; idempotent via unique idempotency key. */
  async enqueue(input: {
    jobType: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    // Check-then-act races under concurrent retries (double-submit): both
    // pass the select, one hits the unique constraint and 500s as "Upload
    // failed" even though the document ingested fine. ON CONFLICT absorbs
    // the loser, then re-select returns the winner's row.
    const [row] = await db
      .insert(jobRuns)
      .values({
        jobType: input.jobType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .onConflictDoNothing({ target: jobRuns.idempotencyKey })
      .returning();
    if (row) return row;
    if (!input.idempotencyKey) throw new Error("Job enqueue failed.");
    const [existing] = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.idempotencyKey, input.idempotencyKey));
    if (!existing) throw new Error("Job enqueue failed.");
    return existing;
  },

  /** Claim-and-run one pending/failed job. Safe to call repeatedly.
   *  FOR UPDATE SKIP LOCKED lets concurrent workers never double-claim. */
  async runOnce(): Promise<{ ran: boolean; jobId?: string; status?: string }> {
    // Claim: mark the oldest pending (or retryable failed) job as running.
    const claimed = await db.execute(sql`
      UPDATE job_runs SET status = 'running', attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT id FROM job_runs
        WHERE status = 'pending' OR (status = 'failed' AND attempts < 5)
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, job_type, payload, attempts;
    `);
    const row = (claimed.rows?.[0] ?? null) as
      | { id: string; job_type: string; payload: Record<string, unknown>; attempts: number }
      | null;
    if (!row) return { ran: false };
    const handler = jobHandlers.get(row.job_type);
    if (!handler) {
      await db
        .update(jobRuns)
        .set({ status: "dead", lastError: "no handler registered", finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(jobRuns.id, row.id));
      return { ran: true, jobId: row.id, status: "dead" };
    }
    try {
      const result = await handler(row.payload, row.id);
      await db
        .update(jobRuns)
        .set({ status: "done", result: result ?? null, finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(jobRuns.id, row.id));
      return { ran: true, jobId: row.id, status: "done" };
    } catch (err) {
      const dead = row.attempts >= 5;
      await db
        .update(jobRuns)
        .set({
          status: dead ? "dead" : "failed",
          lastError: String(err).slice(0, 500),
          finishedAt: dead ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(jobRuns.id, row.id));
      return { ran: true, jobId: row.id, status: dead ? "dead" : "failed" };
    }
  },

  /** Requeue a dead job for operator-driven retry. */
  async requeue(jobId: string) {
    await db
      .update(jobRuns)
      .set({ status: "pending", attempts: 0, lastError: null, finishedAt: null, updatedAt: new Date() })
      .where(and(eq(jobRuns.id, jobId), eq(jobRuns.status, "dead")));
  },

  async failed() {
    return db
      .select()
      .from(jobRuns)
      .where(sql`${jobRuns.status} IN ('failed','dead')`)
      .orderBy(jobRuns.createdAt);
  },
};
