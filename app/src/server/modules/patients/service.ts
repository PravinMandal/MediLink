/**
 * Patient module — the longitudinal record owner.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { patients } from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { generatePatientCode } from "@/server/modules/identity/patient-code";

/** Canonical self-reported blood groups (matches the profile form select). */
const BLOOD_GROUPS = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);

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
    // Service-level validation (the form constrains input, but direct POSTs
    // bypass it): ABHA must be empty or exactly 14 digits (stored
    // digits-only, matching the lookup's digit-equal comparison); blood group
    // must be a known type; free-text fields are length-capped.
    const clean: typeof patch = { ...patch };
    if (clean.abhaNumber !== undefined) {
      // Same gate as lookupIdentifier: a stored number that lookup would
      // reject as checksum-invalid is unfindable — reject it at write time.
      const { isAbhaNumber } = await import("@/server/modules/identity/patient-code");
      const digits = clean.abhaNumber.replace(/[^0-9]/g, "");
      if (digits !== "" && !isAbhaNumber(digits)) throw new Error("INVALID_ABHA");
      clean.abhaNumber = digits;
    }
    if (
      clean.bloodGroupSelfReported !== undefined &&
      clean.bloodGroupSelfReported !== "" &&
      !BLOOD_GROUPS.has(clean.bloodGroupSelfReported.trim().toUpperCase())
    ) {
      throw new Error("INVALID_BLOOD_GROUP");
    }
    if (clean.bloodGroupSelfReported) {
      clean.bloodGroupSelfReported = clean.bloodGroupSelfReported.trim().toUpperCase();
    }
    for (const k of ["phone", "addressCity", "emergencyContactName", "emergencyContactPhone"] as const) {
      if (typeof clean[k] === "string" && (clean[k] as string).length > 120) {
        throw new Error("FIELD_TOO_LONG");
      }
    }
    const [updated] = await db
      .update(patients)
      .set(clean)
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

  async count(): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(patients);
    return row?.n ?? 0;
  },
};
