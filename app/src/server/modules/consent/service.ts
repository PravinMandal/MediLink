/**
 * Consent service — patients control who sees what, for how long, and why.
 * DPDP-aligned: purpose + scope + expiry + one-tap revoke + audit trail.
 */
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { consents, organizations, practitioners } from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { notify } from "@/server/modules/notifications/service";

export const ALL_SCOPES = [
  "demographics",
  "conditions",
  "allergies",
  "medications",
  "lab_results",
  "imaging",
  "procedures",
  "documents",
  "sensitive",
] as const;

export type ConsentScope = (typeof ALL_SCOPES)[number];

export const SCOPE_LABELS: Record<ConsentScope, string> = {
  demographics: "Demographics & identity",
  conditions: "Conditions & diagnoses",
  allergies: "Allergies",
  medications: "Medications & prescriptions",
  lab_results: "Lab results",
  imaging: "Imaging & radiology",
  procedures: "Procedures & surgeries",
  documents: "Source documents",
  sensitive: "Sensitive records",
};

export const consent = {
  async grant(input: {
    patientId: string;
    patientUserId: string;
    granteeType: "practitioner" | "organization";
    granteePractitionerId?: string;
    granteeOrganizationId?: string;
    scopes: ConsentScope[];
    purpose: (typeof consents.$inferSelect)["purpose"];
    days: number;
    granteeName?: string;
    granteeUserId?: string | null;
  }) {
    const [row] = await db
      .insert(consents)
      .values({
        patientId: input.patientId,
        granteeType: input.granteeType,
        granteePractitionerId: input.granteePractitionerId ?? null,
        granteeOrganizationId: input.granteeOrganizationId ?? null,
        scopes: input.scopes,
        purpose: input.purpose,
        expiresAt: new Date(Date.now() + input.days * 24 * 60 * 60 * 1000),
      })
      .returning();

    await audit.record({
      actorId: input.patientUserId,
      actorRole: "patient",
      patientId: input.patientId,
      action: "consent.granted",
      resourceType: "consent",
      resourceId: row.id,
      metadata: {
        granteeType: input.granteeType,
        grantee: input.granteePractitionerId ?? input.granteeOrganizationId,
        scopes: input.scopes,
        purpose: input.purpose,
        days: input.days,
      },
    });

    if (input.granteeUserId) {
      await notify.push({
        userId: input.granteeUserId,
        type: "consent.granted",
        title: `A patient granted you access`,
        body: `Scope: ${input.scopes.join(", ")} · valid ${input.days} days`,
        link: "/portal/doctor",
      });
    }

    return row;
  },

  async revoke(patientUserId: string, consentId: string) {
    const [row] = await db
      .select()
      .from(consents)
      .where(eq(consents.id, consentId));
    if (!row) throw new Error("Consent not found");

    await db
      .update(consents)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(consents.id, consentId));

    await audit.record({
      actorId: patientUserId,
      actorRole: "patient",
      patientId: row.patientId,
      action: "consent.revoked",
      resourceType: "consent",
      resourceId: consentId,
    });

    return true;
  },

  /** Flip expired grants to their terminal state (cheap, idempotent). */
  async expireStale(): Promise<void> {
    await db
      .update(consents)
      .set({ status: "expired" })
      .where(
        and(
          eq(consents.status, "active"),
          lt(consents.expiresAt, new Date()),
        ),
      );
  },

  async listForPatient(patientId: string) {
    const rows = await db
      .select()
      .from(consents)
      .where(eq(consents.patientId, patientId))
      .orderBy(desc(consents.createdAt));

    // Enrich with grantee names
    const practitionerIds = rows
      .map((r) => r.granteePractitionerId)
      .filter((x): x is string => !!x);
    const orgIds = rows
      .map((r) => r.granteeOrganizationId)
      .filter((x): x is string => !!x);

    const practitionersById = new Map<string, { fullName: string; specialty: string | null }>();
    if (practitionerIds.length) {
      const ps = await db
        .select({ id: practitioners.id, fullName: practitioners.fullName, specialty: practitioners.specialty })
        .from(practitioners)
        .where(inArray(practitioners.id, practitionerIds));
      for (const p of ps) practitionersById.set(p.id, p);
    }
    const orgsById = new Map<string, { name: string; type: string }>();
    if (orgIds.length) {
      const os = await db
        .select({ id: organizations.id, name: organizations.name, type: organizations.type })
        .from(organizations)
        .where(inArray(organizations.id, orgIds));
      for (const o of os) orgsById.set(o.id, o);
    }

    return rows.map((r) => ({
      ...r,
      grantee:
        r.granteePractitionerId && practitionersById.get(r.granteePractitionerId)
          ? practitionersById.get(r.granteePractitionerId)!.fullName
          : r.granteeOrganizationId && orgsById.get(r.granteeOrganizationId)
            ? orgsById.get(r.granteeOrganizationId)!.name
            : "Unknown",
    }));
  },

  /** Active, unexpired grants for a practitioner on a patient. */
  async activeForPractitioner(patientId: string, practitionerId: string) {
    return db
      .select()
      .from(consents)
      .where(
        and(
          eq(consents.patientId, patientId),
          eq(consents.granteePractitionerId, practitionerId),
          eq(consents.status, "active"),
          gt(consents.expiresAt, new Date()),
        ),
      );
  },

  async activeForOrganization(patientId: string, organizationId: string) {
    return db
      .select()
      .from(consents)
      .where(
        and(
          eq(consents.patientId, patientId),
          eq(consents.granteeOrganizationId, organizationId),
          eq(consents.status, "active"),
          gt(consents.expiresAt, new Date()),
        ),
      );
  },
};
