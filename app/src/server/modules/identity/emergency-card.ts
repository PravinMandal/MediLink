/**
 * Emergency-card tokens (BuildPlan §7.12 "opaque signed QR").
 *
 * The printed card's QR encodes /e/<token> — an opaque, high-entropy,
 * rotatable token. It carries no patient data and grants nothing by itself:
 * a scan only ever routes an authenticated clinician to the audited
 * emergency-access path for the one patient the token maps to. The raw token
 * is stored so the card re-renders identically (a printed card keeps
 * working); rotation is an explicit patient action for lost cards, and the
 * SHA-256 hash index means a stolen database does not enable token forgery.
 */
import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { emergencyCardTokens, patients } from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";

const TOKEN_BYTES = 20; // 160-bit random component

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function assertOwnership(patientUserId: string, patientId: string) {
  const [owned] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, patientUserId)));
  if (!owned) throw new Error("ACCESS_DENIED");
}

export const emergencyCard = {
  /**
   * The token to encode on the card: reuse the active one so a printed card
   * stays valid across page visits; mint one on first use.
   */
  async issue(patientUserId: string, patientId: string): Promise<{ token: string }> {
    await assertOwnership(patientUserId, patientId);
    const [existing] = await db
      .select({ token: emergencyCardTokens.token })
      .from(emergencyCardTokens)
      .where(
        and(
          eq(emergencyCardTokens.patientId, patientId),
          isNull(emergencyCardTokens.revokedAt),
        ),
      )
      .orderBy(desc(emergencyCardTokens.createdAt))
      .limit(1);
    if (existing) return { token: existing.token };

    const token = newToken();
    await db.insert(emergencyCardTokens).values({
      patientId,
      token,
      tokenHash: hashToken(token),
    });
    await audit.record({
      actorId: patientUserId,
      actorRole: "patient",
      patientId,
      action: "emergency_card.issued",
      resourceType: "emergency_card_token",
    });
    return { token };
  },

  /** Patient rotates the card token (lost/reprinted card). Old stops resolving. */
  async rotate(patientUserId: string, patientId: string): Promise<{ token: string }> {
    await assertOwnership(patientUserId, patientId);
    const token = newToken();
    await db.transaction(async (tx) => {
      await tx
        .update(emergencyCardTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(emergencyCardTokens.patientId, patientId),
            isNull(emergencyCardTokens.revokedAt),
          ),
        );
      await tx.insert(emergencyCardTokens).values({
        patientId,
        token,
        tokenHash: hashToken(token),
      });
    });
    await audit.record({
      actorId: patientUserId,
      actorRole: "patient",
      patientId,
      action: "emergency_card.rotated",
      resourceType: "emergency_card_token",
      reason: "card replaced — previous code revoked",
    });
    return { token };
  },

  /**
   * Resolve a scanned token to its patient. Records usage for abuse review;
   * unknown and revoked tokens produce the identical outcome.
   */
  async resolve(token: string): Promise<{ patientId: string } | null> {
    const trimmed = token.trim().toLowerCase();
    if (!trimmed || !/^[0-9a-f]{40}$/.test(trimmed)) return null;
    const [row] = await db
      .select({
        id: emergencyCardTokens.id,
        patientId: emergencyCardTokens.patientId,
        useCount: emergencyCardTokens.useCount,
      })
      .from(emergencyCardTokens)
      .where(
        and(
          eq(emergencyCardTokens.tokenHash, hashToken(trimmed)),
          isNull(emergencyCardTokens.revokedAt),
        ),
      )
      .limit(1);
    if (!row) {
      await audit.record({
        actorId: null,
        action: "emergency_card.scan_invalid",
        resourceType: "emergency_card_token",
        reason: "unknown or revoked token",
      });
      return null;
    }
    await db
      .update(emergencyCardTokens)
      .set({ lastUsedAt: new Date(), useCount: row.useCount + 1 })
      .where(eq(emergencyCardTokens.id, row.id));
    return { patientId: row.patientId };
  },
};
