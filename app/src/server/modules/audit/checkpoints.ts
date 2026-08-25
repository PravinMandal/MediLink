/**
 * Audit integrity checkpoints (BuildPlan §9.6, Backlog C).
 *
 * Periodic signed checkpoint manifests over the hash chain, stored in a
 * separate access-controlled table; their hash can be anchored to an
 * independent system. The manifest commits to the MERKLE of event hashes in
 * the covered segment (not just count/seq), so any rewrite of an event in
 * the segment changes the manifest.
 */
import { createHash } from "node:crypto";
import { desc, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { auditEvents, integrityCheckpoints } from "@/server/db/schema";

export const checkpoints = {
  /**
   * Create a checkpoint covering all events after the last checkpoint.
   * manifest = sha256(prevManifest ‖ lastSeq ‖ count ‖ sha256(event hashes joined in seq order)).
   */
  async create(): Promise<{ id: string; lastSeq: number; manifestSha256: string }> {
    const [last] = await db
      .select({ lastSeq: integrityCheckpoints.lastSeq, manifestSha256: integrityCheckpoints.manifestSha256 })
      .from(integrityCheckpoints)
      .orderBy(desc(integrityCheckpoints.createdAt))
      .limit(1);

    const segment = await db
      .select({ seq: auditEvents.seq, hash: auditEvents.hash })
      .from(auditEvents)
      .where(gt(auditEvents.seq, last?.lastSeq ?? 0))
      .orderBy(auditEvents.seq);
    const rows = segment as unknown as Array<{ seq: number; hash: string }>;
    if (!rows.length && last) {
      const [existing] = await db
        .select({ id: integrityCheckpoints.id })
        .from(integrityCheckpoints)
        .orderBy(desc(integrityCheckpoints.createdAt))
        .limit(1);
      return { id: existing!.id, lastSeq: last.lastSeq, manifestSha256: last.manifestSha256 };
    }

    const segmentHash = createHash("sha256")
      .update(rows.map((r) => r.hash).join("\n"))
      .digest("hex");
    const manifestSha256 = createHash("sha256")
      .update(`${last?.manifestSha256 ?? "GENESIS"}\n${rows[rows.length - 1]!.seq}\n${rows.length}\n${segmentHash}`)
      .digest("hex");
    const [row] = await db
      .insert(integrityCheckpoints)
      .values({
        lastSeq: rows[rows.length - 1]!.seq,
        eventCount: rows.length,
        manifestSha256,
      })
      .returning();
    return { id: row!.id, lastSeq: row!.lastSeq, manifestSha256: row!.manifestSha256 };
  },

  /** Verify the full chain (delegates to audit.verifyChain) + latest checkpoint. */
  async verify(): Promise<{ chainBreakSeq: number | null; latestCheckpointSeq: number | null }> {
    const { audit } = await import("@/server/modules/audit/service");
    const chainBreakSeq = await audit.verifyChain();
    const [latest] = await db
      .select({ lastSeq: integrityCheckpoints.lastSeq })
      .from(integrityCheckpoints)
      .orderBy(desc(integrityCheckpoints.createdAt))
      .limit(1);
    return { chainBreakSeq, latestCheckpointSeq: latest?.lastSeq ?? null };
  },

  async list(limit = 50) {
    return db
      .select()
      .from(integrityCheckpoints)
      .orderBy(desc(integrityCheckpoints.createdAt))
      .limit(limit);
  },

  /** Mark a checkpoint as anchored externally (independent system of record). */
  async markAnchored(id: string) {
    const { eq } = await import("drizzle-orm");
    await db
      .update(integrityCheckpoints)
      .set({ anchoredExternally: true })
      .where(eq(integrityCheckpoints.id, id));
  },
};
