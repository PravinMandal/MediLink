/**
 * Consent service — patients control who sees what, for how long, and why.
 * DPDP-aligned: purpose + scope + expiry + one-tap revoke + audit trail.
 */
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { consents, organizations, patients, practitioners } from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { notify } from "@/server/modules/notifications/service";

// Scopes patients can actually be offered/granted. "sensitive" stays valid
// in the DB enum for legacy rows but is deliberately absent: it gates no
// resource in the schema (scopeForResource never returns it), so offering
// it would be a placebo grant.
export const ALL_SCOPES = [
  "demographics",
  "conditions",
  "allergies",
  "medications",
  "lab_results",
  "imaging",
  "procedures",
  "documents",
] as const;

export type ConsentScope = (typeof ALL_SCOPES)[number] | "sensitive";

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

/** Scopes offered in consent UIs — "sensitive" is excluded (grants nothing). */
export const OFFERED_SCOPES: ConsentScope[] = [...ALL_SCOPES];

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
    // P1: the service is the last line of defense — validate everything
    // here, not just in the action caller. Ownership (patientUserId owns
    // patientId) stays caller-enforced: grants for not-yet-linked patients
    // are a supported flow, and every production caller proves ownership
    // via patientService.forUser first.
    const scopes = [...new Set(input.scopes)].filter((s): s is ConsentScope =>
      (OFFERED_SCOPES as readonly string[]).includes(s),
    );
    if (!scopes.length) throw new Error("No valid scopes to grant.");
    const days = Math.min(Math.max(Math.floor(input.days) || 7, 1), 365);
    if (input.granteeType === "practitioner") {
      if (!input.granteePractitionerId) throw new Error("Missing practitioner.");
      const [p] = await db
        .select({ id: practitioners.id })
        .from(practitioners)
        .where(eq(practitioners.id, input.granteePractitionerId));
      if (!p) throw new Error("Practitioner not found.");
    } else {
      if (!input.granteeOrganizationId) throw new Error("Missing organization.");
      const [o] = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, input.granteeOrganizationId));
      if (!o) throw new Error("Organization not found.");
    }
    const [row] = await db
      .insert(consents)
      .values({
        patientId: input.patientId,
        granteeType: input.granteeType,
        granteePractitionerId: input.granteePractitionerId ?? null,
        granteeOrganizationId: input.granteeOrganizationId ?? null,
        scopes,
        purpose: input.purpose,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      })
      .returning();

    // H3 tradeoff: the grant is already committed. A failed audit append
    // must not surface as a failed grant (the user would retry and be
    // confused); log loudly instead. record() has bounded retries for the
    // common (fork-race) failure mode, so reaching here is rare.
    try {
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
          scopes,
          purpose: input.purpose,
          days,
        },
      });
    } catch (err) {
      console.error("[audit] write failed (consent.granted)", err);
    }

    if (input.granteeUserId) {
      await notify.push({
        userId: input.granteeUserId,
        type: "consent.granted",
        title: `A patient granted you access`,
        body: `Scope: ${scopes.join(", ")} · valid ${days} days`,
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
    // Ownership is mandatory (§7.8): the caller's patient record must own
    // this grant. A mismatched or missing consent is a uniform failure —
    // no existence oracle for other patients' grants.
    if (!row) throw new Error("Consent not found");
    const { patients } = await import("@/server/db/schema");
    const [owner] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, row.patientId), eq(patients.userId, patientUserId)));
    if (!owner) throw new Error("Consent not found");

    const [updated] = await db
      .update(consents)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(
        and(
          eq(consents.id, consentId),
          // Re-check inside the UPDATE so a concurrent re-grant/re-target can
          // never be revoked by a stale read (defense in depth).
          eq(consents.patientId, owner.id),
        ),
      )
      .returning();
    if (!updated) throw new Error("Consent not found");

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

  /** Patients with an ACTIVE document-scope grant to this organization —
   *  the source of truth for who a facility may upload for, regardless of
   *  which facility registered them. */
  async patientsWithDocumentConsent(organizationId: string) {
    const rows = await db
      .select({
        id: patients.id,
        fullName: patients.fullName,
        createdAt: patients.createdAt,
        expiresAt: consents.expiresAt,
        scopes: consents.scopes,
      })
      .from(consents)
      .innerJoin(patients, eq(patients.id, consents.patientId))
      .where(
        and(
          eq(consents.granteeOrganizationId, organizationId),
          eq(consents.status, "active"),
          gt(consents.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(consents.createdAt))
      .limit(50);
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      fullName: string;
      createdAt: Date;
      expiresAt: Date;
    }> = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      if (!(r.scopes as string[]).includes("documents")) continue;
      seen.add(r.id);
      out.push({
        id: r.id,
        fullName: r.fullName,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      });
    }
    return out;
  },
};
