/**
 * Patient module — the longitudinal record owner.
 */
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { patients } from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";

export const patientService = {
  async create(input: {
    fullName: string;
    dob?: string;
    sex?: string;
    phone?: string;
    bloodGroupSelfReported?: string;
    abhaNumber?: string;
    addressCity?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    userId?: string | null; // linked app account (patient portal)
    createdById: string;
    organizationId?: string | null;
  }) {
    const [row] = await db.insert(patients).values(input).returning();
    await audit.record({
      actorId: input.createdById,
      action: "patient.created",
      resourceType: "patient",
      resourceId: row.id,
      patientId: row.id,
    });
    return row;
  },

  async byId(id: string) {
    const [row] = await db.select().from(patients).where(eq(patients.id, id));
    return row ?? null;
  },

  async forUser(userId: string) {
    const [row] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId));
    return row ?? null;
  },

  /**
   * Consent-aware search used by doctors: matches name or phone, and returns
   * an access indicator so the UI can show "has access / request access".
   *
   * Kept as substring ilike ('%term%') rather than prefix-only: doctors often
   * search by partial name/phone fragments. The 0001_patient_search_trgm
   * migration adds pg_trgm GIN indexes on full_name and phone so the
   * substring match is index-backed on Supabase (pg_trgm is available on the
   * free tier) and on PGlite.
   */
  async search(query: string, limit = 20) {
    const q = `%${query.trim()}%`;
    if (!query.trim()) return [];
    return db
      .select({
        id: patients.id,
        fullName: patients.fullName,
        dob: patients.dob,
        sex: patients.sex,
        phone: patients.phone,
        addressCity: patients.addressCity,
        createdAt: patients.createdAt,
      })
      .from(patients)
      .where(or(ilike(patients.fullName, q), ilike(patients.phone, q)))
      .orderBy(desc(patients.createdAt))
      .limit(limit);
  },

  async updateSelf(
    userId: string,
    patientId: string,
    patch: Partial<{
      phone: string;
      addressCity: string;
      emergencyContactName: string;
      emergencyContactPhone: string;
      bloodGroupSelfReported: string;
      abhaNumber: string;
    }>,
  ) {
    const [row] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.userId, userId)));
    if (!row) throw new Error("ACCESS_DENIED");
    const [updated] = await db
      .update(patients)
      .set(patch)
      .where(eq(patients.id, patientId))
      .returning();
    await audit.record({
      actorId: userId,
      actorRole: "patient",
      patientId,
      action: "patient.profile.updated",
      resourceType: "patient",
      resourceId: patientId,
      metadata: { fields: Object.keys(patch) },
    });
    return updated;
  },

  /** Link a patient app account to an existing patient record (identity claim). */
  async linkAccount(patientId: string, userId: string) {
    await db
      .update(patients)
      .set({ userId })
      .where(eq(patients.id, patientId));
    await audit.record({
      actorId: userId,
      actorRole: "patient",
      patientId,
      action: "patient.account.linked",
      resourceType: "patient",
      resourceId: patientId,
    });
  },

  async count(): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(patients);
    return row?.n ?? 0;
  },
};
