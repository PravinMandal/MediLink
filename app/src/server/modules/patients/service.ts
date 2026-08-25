/**
 * Patient module — the longitudinal record owner.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { patients } from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { generatePatientCode } from "@/server/modules/identity/patient-code";

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
    const [row] = await db
      .insert(patients)
      .values({
        ...input,
        // Non-enumerable public identifier (BuildPlan §8.1), assigned at
        // creation; never derived from demographics.
        patientCode: generatePatientCode(),
      })
      .returning();
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

  // NOTE: the former name/phone directory search was REMOVED per BuildPlan
  // §14-B4: doctor discovery is ID/verified-ABHA-only via
  // identity/discovery.ts, which discloses nothing before authorization.

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
