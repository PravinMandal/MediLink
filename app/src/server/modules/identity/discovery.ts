/**
 * Controlled discovery (BuildPlan §8.2, §7.9 Find patient, Backlog B):
 * - ID / verified-ABHA lookup ONLY — no name/phone directory.
 * - Before authorization a lookup reveals NOTHING beyond "a record may
 *   exist": no name, DOB, city, phone, record count, or clinical metadata.
 * - Patient-present handoff: opaque, single-use, short-lived tokens.
 * - Rate limiting with abuse audit on lookup attempts.
 */
import { createHash } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  patientHandoffTokens,
  patients,
  patientIdentifiers,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { rateLimit, LIMITS } from "@/server/modules/security/rate-limit";
import {
  isAbhaNumber,
  normalizePatientCode,
} from "@/server/modules/identity/patient-code";

export const LOOKUP_RATE_LIMIT = LIMITS.lookup;
export { rateLimit };

export type LookupOutcome =
  | { kind: "invalid"; message: string }
  | { kind: "rate_limited"; message: string }
  | {
      kind: "no_record";
      message: string;
    }
  | {
      kind: "record_may_exist";
      patientId: string;
      /** Caller must check authorization before revealing anything. */
    }
  | {
      kind: "handoff";
      patientId: string;
      /** clinician already holds a fresh patient-present approval */
    };

export const discovery = {
  /**
   * Resolve an identifier to a patient WITHOUT disclosing demographics.
   * Returns only whether a record may exist (plus the internal id for the
   * caller's authorization check — never surfaced pre-consent).
   */
  async lookupIdentifier(input: {
    actorId: string;
    identifier: string;
    correlationId?: string;
  }): Promise<LookupOutcome> {
    if (!rateLimit(`lookup:${input.actorId}`, LIMITS.lookup)) {
      await audit.record({
        actorId: input.actorId,
        actorRole: "doctor",
        action: "patient.lookup.rate_limited",
        reason: "lookup rate limit exceeded",
        metadata: { correlationId: input.correlationId ?? null },
      });
      return {
        kind: "rate_limited",
        message: "Too many lookups. Wait a minute and try again.",
      };
    }

    const raw = input.identifier.trim();
    if (!raw) return { kind: "invalid", message: "Enter a Patient ID or ABHA number." };

    let patientId: string | null = null;

    const code = normalizePatientCode(raw);
    if (code) {
      const [row] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.patientCode, code));
      patientId = row?.id ?? null;
    } else if (isAbhaNumber(raw)) {
      const digits = raw.replace(/[^0-9]/g, "");
      // Verified-ABHA lookup (§7.9). Two sources:
      //  1. patient_identifiers — registry-style verified identifiers
      //     (digit-normalized on write), matched in one indexed query.
      //  2. patients.abha_number — the patient's own profile field; a
      //     self-reported ABHA is only discoverable once the account has a
      //     linked login AND the number is digit-equal. This keeps lookup
      //     working today without waiting for an ABDM verification adapter,
      //     while never widening what a lookup discloses.
      const [idRow] = await db
        .select({ patientId: patientIdentifiers.patientId })
        .from(patientIdentifiers)
        .where(
          and(
            eq(patientIdentifiers.type, "abha_number"),
            eq(patientIdentifiers.verified, true),
            eq(sql`replace(${patientIdentifiers.value}, '-', '')`, digits),
          ),
        )
        .limit(1);
      if (idRow) {
        patientId = idRow.patientId;
      } else {
        const [pRow] = await db
          .select({ id: patients.id })
          .from(patients)
          .where(
            and(
              eq(sql`replace(coalesce(${patients.abhaNumber}, ''), '-', '')`, digits),
              // Only patients with a claimed account are discoverable by
              // self-reported ABHA — an unclaimed provisional record must
              // not be reachable this way.
              sql`${patients.userId} is not null`,
            ),
          )
          .limit(1);
        if (pRow) {
          patientId = pRow.id;
        }
      }
    } else {
      return {
        kind: "invalid",
        message:
          "Enter a valid Patient ID (ML-XXXXX-XXXXX-C) or a 14-digit ABHA number.",
      };
    }

    // Privacy-safe audit of the attempt (no identifier value in metadata).
    await audit.record({
      actorId: input.actorId,
      actorRole: "doctor",
      action: "patient.lookup",
      reason: code ? "patient_code" : isAbhaNumber(raw) ? "abha" : "invalid",
      metadata: { found: !!patientId, correlationId: input.correlationId ?? null },
    });

    if (!patientId) {
      // Uniform message: never leak whether an arbitrary ID exists vs invalid.
      return {
        kind: "no_record",
        message:
          "No MediLink record is associated with this identifier. If the patient is with you, they can start a sharing session from their app.",
      };
    }
    return { kind: "record_may_exist", patientId };
  },

  /* ---------------- Patient-present handoff ---------------- */

  /** Patient creates an opaque single-use handoff code (valid 10 minutes). */
  async createHandoff(patientUserId: string, patientId: string) {
    // Ownership check
    const [row] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.userId, patientUserId)));
    if (!row) throw new Error("ACCESS_DENIED");

    const secret = crypto.randomUUID().replace(/-/g, "");
    const code = `${secret.slice(0, 4)}-${secret.slice(4, 8)}-${secret.slice(8, 12)}`;
    const tokenHash = createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(patientHandoffTokens).values({
      tokenHash,
      patientId,
      code: null, // only the hash is stored; the code is shown once to the patient
      expiresAt,
    });
    await audit.record({
      actorId: patientUserId,
      actorRole: "patient",
      patientId,
      action: "handoff.created",
      resourceType: "handoff_token",
      metadata: { expiresAt: expiresAt.toISOString() },
    });
    return { code, expiresAt };
  },

  /** Clinician redeems a handoff code. Single-use, short-lived, audited. */
  async redeemHandoff(input: { clinicianUserId: string; code: string }) {
    if (!rateLimit(`handoff:${input.clinicianUserId}`, LIMITS.handoff)) {
      return { ok: false as const, message: "Too many attempts. Wait a minute." };
    }
    const tokenHash = createHash("sha256").update(input.code.trim()).digest("hex");
    const [token] = await db
      .select()
      .from(patientHandoffTokens)
      .where(
        and(
          eq(patientHandoffTokens.tokenHash, tokenHash),
          isNull(patientHandoffTokens.usedAt),
          gt(patientHandoffTokens.expiresAt, new Date()),
        ),
      );
    if (!token) {
      await audit.record({
        actorId: input.clinicianUserId,
        actorRole: "doctor",
        action: "handoff.redeem_failed",
        reason: "invalid, expired, or already used code",
      });
      return {
        ok: false as const,
        message: "This code is invalid, expired, or already used. Ask the patient for a new one.",
      };
    }
    // Atomically mark used — a second redeem of the same row fails.
    const [claimed] = await db
      .update(patientHandoffTokens)
      .set({ usedAt: new Date(), usedByUserId: input.clinicianUserId })
      .where(
        and(
          eq(patientHandoffTokens.id, token.id),
          isNull(patientHandoffTokens.usedAt),
        ),
      )
      .returning();
    if (!claimed) {
      return { ok: false as const, message: "This code was just used." };
    }
    await audit.record({
      actorId: input.clinicianUserId,
      actorRole: "doctor",
      patientId: token.patientId,
      action: "handoff.redeemed",
      resourceType: "handoff_token",
      resourceId: token.id,
    });
    return { ok: true as const, patientId: token.patientId };
  },
};
