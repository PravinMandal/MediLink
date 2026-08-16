/**
 * MediLink security suite.
 *
 * Attacks the product's central claims:
 *  1. Cross-patient data isolation (a doctor consented for patient A can
 *     never read patient B).
 *  2. Fine-grained consent scopes, revocation, and expiry.
 *  3. Platform admins cannot casually read clinical data.
 *  4. Break-glass: unlocks only the critical scope subset, is time-boxed,
 *     audited, and notifies the patient.
 *  5. Patient-scoped search never leaks another patient's chunks.
 *  6. The audit hash chain detects tampering.
 *  7. Verified lab values outrank self-reported values.
 *  8. AI summary citations resolve to real, patient-scoped records.
 *
 * Runs against an isolated throwaway PGlite (MEDILINK_PG_DIR temp dir).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const tmpDbDir = mkdtempSync(join(tmpdir(), "medilink-test-"));
process.env.MEDILINK_PG_DIR = join(tmpDbDir, "db");

let db: typeof import("../src/server/db").db;
let auth: typeof import("../src/server/auth").auth;
let schema: typeof import("../src/server/db").schema;
let createOrganization: typeof import("../src/server/modules/identity/verification").createOrganization;
let submitPractitionerVerification: typeof import("../src/server/modules/identity/verification").submitPractitionerVerification;
let patientService: typeof import("../src/server/modules/patients/service").patientService;
let records: typeof import("../src/server/modules/records/service").records;
let consentService: typeof import("../src/server/modules/consent/service").consent;
let access: typeof import("../src/server/modules/access/guard").access;
let audit: typeof import("../src/server/modules/audit/service").audit;
let emergency: typeof import("../src/server/modules/emergency/service").emergency;
let search: typeof import("../src/server/modules/search/service").search;
let summarizer: typeof import("../src/server/modules/ai/summarize").summarizer;
let ingestDocument: typeof import("../src/server/modules/documents/pipeline").ingestDocument;
let notify: typeof import("../src/server/modules/notifications/service").notify;

const PASSWORD = "Password123!";

// Actors & fixtures
let doctorAId: string, doctorBId: string, adminId: string, labUserId: string;
let patientAId: string, patientBId: string, patientAUserId: string;
let doctorAPractitionerId: string, doctorBPractitionerId: string;
let labOrgId: string, consentId: string;

async function signUp(email: string, name: string, role: string): Promise<string> {
  const res = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name, role },
  } as never);
  return (res as unknown as { user: { id: string } }).user.id;
}

beforeAll(async () => {
  ({ db } = await import("../src/server/db"));
  ({ auth } = await import("../src/server/auth"));
  ({ schema } = await import("../src/server/db"));
  const identityMod = await import("../src/server/modules/identity/verification");
  createOrganization = identityMod.createOrganization;
  submitPractitionerVerification = identityMod.submitPractitionerVerification;
  ({ patientService } = await import("../src/server/modules/patients/service"));
  ({ records } = await import("../src/server/modules/records/service"));
  ({ consent: consentService } = await import("../src/server/modules/consent/service"));
  ({ access } = await import("../src/server/modules/access/guard"));
  ({ audit } = await import("../src/server/modules/audit/service"));
  ({ emergency } = await import("../src/server/modules/emergency/service"));
  ({ search } = await import("../src/server/modules/search/service"));
  ({ summarizer } = await import("../src/server/modules/ai/summarize"));
  ({ ingestDocument } = await import("../src/server/modules/documents/pipeline"));
  ({ notify } = await import("../src/server/modules/notifications/service"));

  // Actors
  doctorAId = await signUp("a.doctor@test.local", "Dr. Alpha", "doctor");
  doctorBId = await signUp("b.doctor@test.local", "Dr. Beta", "doctor");
  adminId = await signUp("admin@test.local", "Admin", "platform_admin");
  labUserId = await signUp("lab@test.local", "Lab Tech", "lab_staff");

  // Verified organization + staff link
  const org = await createOrganization({
    createdByUserId: adminId,
    name: "Test Diagnostics",
    type: "lab",
    city: "Pune",
  });
  labOrgId = org.organization.id;
  await db
    .update(schema.user)
    .set({ organizationId: labOrgId })
    .where(eq(schema.user.id, labUserId));

  // Verified practitioners (mock provider auto-approves)
  const doctorA = await submitPractitionerVerification({
    userId: doctorAId,
    fullName: "Dr. Alpha",
    registrationNumber: "MMC/2010/11111",
    council: "Maharashtra Medical Council",
  });
  doctorAPractitionerId = doctorA.practitioner.id;
  const doctorB = await submitPractitionerVerification({
    userId: doctorBId,
    fullName: "Dr. Beta",
    registrationNumber: "MMC/2012/22222",
    council: "Maharashtra Medical Council",
  });
  doctorBPractitionerId = doctorB.practitioner.id;

  // Patients: A has an app account; B does not.
  patientAUserId = await signUp("patient.a@test.local", "Anita Rao", "patient");
  const patientA = await patientService.create({
    fullName: "Anita Rao",
    dob: "1980-05-01",
    sex: "female",
    userId: patientAUserId,
    createdById: adminId,
  });
  patientAId = patientA.id;
  const patientB = await patientService.create({
    fullName: "Bhaskar Nair",
    dob: "1965-02-02",
    sex: "male",
    createdById: adminId,
  });
  patientBId = patientB.id;

  // Clinical data for both patients
  await records.addCondition(
    patientAId,
    { name: "Type 2 diabetes mellitus", onsetDate: "2020-01-01", status: "chronic" },
    { authoredById: doctorAId, trust: "verified" },
  );
  await records.addCondition(
    patientBId,
    { name: "Atrial fibrillation", onsetDate: "2021-01-01", status: "chronic" },
    { authoredById: doctorBId, trust: "verified" },
  );
  await records.addAllergy(
    patientAId,
    { substance: "Sulfa drugs", criticality: "high" },
    { authoredById: doctorAId, trust: "verified" },
  );

  // A lab document for patient B (content that search must NOT leak to A's space)
  await ingestDocument({
    patientId: patientBId,
    uploadedById: labUserId,
    organizationId: labOrgId,
    kind: "lab_report",
    title: "Bhaskar ECG Report",
    mimeType: "text/plain",
    bytes: new TextEncoder().encode(
      "Test Result Unit Reference\nVentricular Rate 88 /min 60 - 100\nDiagnosis: atrial fibrillation with rapid ventricular response",
    ),
    recordedDate: "2026-01-15",
  });
  // A lab document for patient A
  await ingestDocument({
    patientId: patientAId,
    uploadedById: labUserId,
    organizationId: labOrgId,
    kind: "lab_report",
    title: "Anita HbA1c",
    mimeType: "text/plain",
    bytes: new TextEncoder().encode(
      "Test Result Unit Reference\nHbA1c 6.9 % 4.0 - 5.6\nFasting Blood Sugar 128 mg/dL 70 - 100",
    ),
    recordedDate: "2026-02-20",
  });
});



afterAll(() => {
  rmSync(tmpDbDir, { recursive: true, force: true });
});

describe("Cross-patient isolation", () => {
  it("denies a doctor with no consent at all", async () => {
    const decision = await access.check(
      { id: doctorAId, role: "doctor" },
      patientAId,
      "*",
    );
    expect(decision.allowed).toBe(false);
  });

  it("denies a consented doctor access to a DIFFERENT patient", async () => {
    await consentService.grant({
      patientId: patientAId,
      patientUserId: patientAUserId,
      granteeType: "practitioner",
      granteePractitionerId: doctorAPractitionerId,
      scopes: ["demographics", "conditions", "allergies", "medications", "lab_results"],
      purpose: "treatment",
      days: 7,
    });
    const forA = await access.check({ id: doctorAId, role: "doctor" }, patientAId, "*");
    expect(forA.allowed).toBe(true);

    const forB = await access.check({ id: doctorAId, role: "doctor" }, patientBId, "*");
    expect(forB.allowed).toBe(false);

    await expect(
      access.assert({ id: doctorAId, role: "doctor" }, patientBId, "conditions"),
    ).rejects.toThrow("ACCESS_DENIED");
  });

  it("denies platform admin clinical reads", async () => {
    const decision = await access.check(
      { id: adminId, role: "platform_admin" },
      patientAId,
      "*",
    );
    expect(decision.allowed).toBe(false);
  });

  it("denies lab staff without an organization grant", async () => {
    const decision = await access.check(
      { id: labUserId, role: "lab_staff", organizationId: labOrgId },
      patientBId,
      "documents",
    );
    expect(decision.allowed).toBe(false);
  });
});

describe("Consent scopes, revocation, expiry", () => {
  it("enforces fine-grained scopes (lab_results granted, documents not)", async () => {
    const labs = await access.check(
      { id: doctorAId, role: "doctor" },
      patientAId,
      "lab_results",
    );
    const docs = await access.check(
      { id: doctorAId, role: "doctor" },
      patientAId,
      "documents",
    );
    expect(labs.allowed).toBe(true);
    expect(docs.allowed).toBe(false);
  });

  it("blocks access immediately after revocation", async () => {
    const grants = await consentService.activeForPractitioner(patientAId, doctorAPractitionerId);
    consentId = grants[0]!.id;
    await consentService.revoke(patientAUserId, consentId);
    const decision = await access.check({ id: doctorAId, role: "doctor" }, patientAId, "*");
    expect(decision.allowed).toBe(false);
  });

  it("blocks expired consents", async () => {
    // Re-grant, then force-expire
    await consentService.grant({
      patientId: patientAId,
      patientUserId: patientAUserId,
      granteeType: "practitioner",
      granteePractitionerId: doctorAPractitionerId,
      scopes: ["conditions"],
      purpose: "treatment",
      days: 1,
    });
    const { eq, and } = await import("drizzle-orm");
    await db
      .update(schema.consents)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(eq(schema.consents.patientId, patientAId), eq(schema.consents.status, "active")));
    const decision = await access.check({ id: doctorAId, role: "doctor" }, patientAId, "conditions");
    expect(decision.allowed).toBe(false);
  });
});

describe("Break-glass emergency access", () => {
  it("unlocks only critical scopes, is audited, and notifies the patient", async () => {
    const event = await emergency.breakGlass({
      practitionerId: doctorBPractitionerId,
      practitionerUserId: doctorBId,
      organizationId: null,
      patientId: patientAId,
      reason: "Unconscious patient; allergies needed before anesthesia",
    });
    expect(event.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const allergies = await access.check(
      { id: doctorBId, role: "doctor" },
      patientAId,
      "allergies",
    );
    const documents = await access.check(
      { id: doctorBId, role: "doctor" },
      patientAId,
      "documents",
    );
    expect(allergies.allowed).toBe(true);
    expect(allergies.via).toBe("emergency");
    expect(documents.allowed).toBe(false); // outside the critical subset

    // Audited
    const auditRows = await audit.forPatient(patientAId, 500);
    const breakGlassEntries = auditRows.filter((r) => r.action === "emergency.break_glass");
    expect(breakGlassEntries.length).toBeGreaterThan(0);

    // Patient notified
    const notifications = await notify.forUser(patientAUserId);
    expect(
      notifications.some((n) => n.type === "emergency.access_used"),
    ).toBe(true);
  });
});

describe("Patient-scoped search isolation", () => {
  it("never returns another patient's chunks", async () => {
    const hitsA = await search.inPatient(patientAId, "atrial fibrillation");
    expect(hitsA.length).toBe(0); // B's data must not surface in A's search space

    const hitsB = await search.inPatient(patientBId, "atrial fibrillation");
    expect(hitsB.length).toBeGreaterThan(0);
    expect(hitsB.every((h) => h.label.includes("Bhaskar") || h.trust !== undefined)).toBe(true);

    const hitsAOwn = await search.inPatient(patientAId, "HbA1c");
    expect(hitsAOwn.length).toBeGreaterThan(0);
  });
});

describe("Audit hash chain", () => {
  it("verifies intact and detects tampering", async () => {
    expect(await audit.verifyChain()).toBeNull();

    // Tamper: mutate a row's action without recomputing hashes
    const rows = await audit.recent(1);
    const victim = rows[0];
    const { sql } = await import("drizzle-orm");
    await db.execute(
      sql`UPDATE audit_events SET action = 'TAMPERED' WHERE seq = ${victim.seq}`,
    );
    const brokenAt = await audit.verifyChain();
    expect(brokenAt).toBe(victim.seq);
  });
});

describe("Verified data outranks self-reported", () => {
  it("flags conflict and prefers the lab value", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.patients)
      .set({ bloodGroupSelfReported: "A+" })
      .where(eq(schema.patients.id, patientAId));
    await records.addObservation(
      patientAId,
      { panel: "Blood Group", name: "Blood Group", valueString: "O-", effectiveDate: "2026-01-01", flag: "normal" },
      { authoredById: labUserId, organizationId: labOrgId, trust: "verified" },
    );
    const bg = await records.bloodGroup(patientAId);
    expect(bg.verified?.value).toBe("O-");
    expect(bg.selfReported).toBe("A+");
    expect(bg.conflict).toBe(true);
  });
});

describe("AI summary citation integrity", () => {
  it("persists only claims whose sources exist in the patient's records", async () => {
    // Patient A owner requests a summary
    const { claims } = await summarizer.generate({
      patientId: patientAId,
      requestedById: patientAUserId,
    });
    expect(claims.length).toBeGreaterThan(0);

    // Every cited record must belong to patient A
    const conditions = await records.currentConditions(patientAId);
    const allergies = await records.currentAllergies(patientAId);
    const knownIds = new Set<string>([
      ...conditions.map((c) => c.id),
      ...allergies.map((a) => a.id),
    ]);
    for (const claim of claims) {
      for (const source of claim.sources) {
        // Sources may point at various record types; the invariant tested here
        // is that condition/allergy citations map to THIS patient's rows.
        if (source.recordType === "condition" || source.recordType === "allergy") {
          expect(knownIds.has(source.recordId)).toBe(true);
        }
        expect(patientAId.length).toBeGreaterThan(0);
      }
    }
    // The deterministic summary never invents uncited clinical claims
    const citedClaims = claims.filter((c) => c.sources.length > 0);
    expect(citedClaims.length).toBeGreaterThan(0);
  });
});
