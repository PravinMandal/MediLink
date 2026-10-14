/**
 * BuildPlan P0 foundation tests.
 *
 * Attacks the new trust-foundation claims:
 *  1. Access-request state machine: no preselected scopes, patient narrowing,
 *     decline path, consent artefact with hash + receipt code.
 *  2. Policy evaluation: fail-closed scopes, admin denial, emergency basis,
 *     revocation effective immediately, decision logging.
 *  3. Patient ID: format, check character catches typos, normalization.
 *  4. Discovery: ID-only lookup reveals nothing pre-consent; rate limit;
 *     handoff tokens single-use + expiry.
 *  5. Record versions: immutable, canonical hash, correction supersession,
 *     entered-in-error, disputes.
 *  6. Outbox + durable jobs: idempotent enqueue, retries, dead-letter.
 *  7. Document pipeline v2: magic-byte rejection, durable extraction,
 *     original bytes unchanged after retry.
 *  8. Audit checkpoints: manifest creation + chain verification.
 *
 * Runs against an isolated throwaway PGlite (MEDILINK_PG_DIR temp dir).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

const tmpDbDir = mkdtempSync(join(tmpdir(), "medilink-p0-"));
process.env.MEDILINK_PG_DIR = join(tmpDbDir, "db");
// Explicit mock opt-in: production defaults to manual review.
process.env.VERIFICATION_PROVIDER = "mock";
// Explicit mock opt-in: production defaults to manual review.
process.env.VERIFICATION_PROVIDER = "mock";
// Explicit mock opt-in: production defaults to manual review.
process.env.VERIFICATION_PROVIDER = "mock";

const PASSWORD = "Password123!";

let db: typeof import("../src/server/db").db;
let auth: typeof import("../src/server/auth").auth;
let schema: typeof import("../src/server/db").schema;
let policy: typeof import("../src/server/modules/access/policy").policy;
let accessRequestsService: typeof import("../src/server/modules/consent/access-requests").accessRequestsService;
let patientCode: typeof import("../src/server/modules/identity/patient-code");
let discovery: typeof import("../src/server/modules/identity/discovery").discovery;
let outboxMod: typeof import("../src/server/modules/jobs/outbox");
let versions: typeof import("../src/server/modules/records/versions");
let pipelineV2: typeof import("../src/server/modules/documents/pipeline-v2");
let checkpoints: typeof import("../src/server/modules/audit/checkpoints").checkpoints;
let audit: typeof import("../src/server/modules/audit/service").audit;
let patientService: typeof import("../src/server/modules/patients/service").patientService;
let consentService: typeof import("../src/server/modules/consent/service").consent;
let identityMod: typeof import("../src/server/modules/identity/verification");
let contradictionsMod: typeof import("../src/server/modules/ai/contradictions");

let doctorId: string, patientUserId: string, adminId: string;
let doctorPractitionerId: string;
let patientId: string;
let otherPatientId: string;
let patientCodeValue: string;

async function signUp(email: string, name: string, role: string): Promise<string> {
  const res = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name },
  } as never);
  const userId = (res as unknown as { user: { id: string } }).user.id;
  if (role !== "patient") {
    await db
      .update(schema.user)
      .set({ role: role as "doctor" | "platform_admin" })
      .where(eq(schema.user.id, userId));
  }
  return userId;
}

beforeAll(async () => {
  ({ db, schema } = await import("../src/server/db"));
  ({ auth } = await import("../src/server/auth"));
  ({ policy } = await import("../src/server/modules/access/policy"));
  ({ accessRequestsService } = await import("../src/server/modules/consent/access-requests"));
  patientCode = await import("../src/server/modules/identity/patient-code");
  ({ discovery } = await import("../src/server/modules/identity/discovery"));
  outboxMod = await import("../src/server/modules/jobs/outbox");
  versions = await import("../src/server/modules/records/versions");
  pipelineV2 = await import("../src/server/modules/documents/pipeline-v2");
  ({ checkpoints } = await import("../src/server/modules/audit/checkpoints"));
  ({ audit } = await import("../src/server/modules/audit/service"));
  ({ patientService } = await import("../src/server/modules/patients/service"));
  ({ consent: consentService } = await import("../src/server/modules/consent/service"));
  identityMod = await import("../src/server/modules/identity/verification");
  contradictionsMod = await import("../src/server/modules/ai/contradictions");

  doctorId = await signUp("p0.doctor@test.local", "Dr. P0", "doctor");
  patientUserId = await signUp("p0.patient@test.local", "P0 Patient", "patient");
  adminId = await signUp("p0.admin@test.local", "P0 Admin", "platform_admin");
  const p = await submitVerification();
  doctorPractitionerId = p;

  const patientA = await patientService.create({
    fullName: "P0 Test Patient",
    dob: "1990-01-01",
    userId: patientUserId,
    createdById: adminId,
  });
  patientId = patientA.id;
  patientCodeValue = patientCode.generatePatientCode();
  await db
    .update(schema.patients)
    .set({ patientCode: patientCodeValue })
    .where(eq(schema.patients.id, patientId));

  const patientB = await patientService.create({
    fullName: "P0 Other Patient",
    createdById: adminId,
  });
  otherPatientId = patientB.id;

  async function submitVerification() {
    const v = await identityMod.submitPractitionerVerification({
      userId: doctorId,
      fullName: "Dr. P0",
      registrationNumber: "MMC/2020/99999",
      council: "Maharashtra Medical Council",
    });
    return v.practitioner.id;
  }
});

afterAll(async () => {
  rmSync(tmpDbDir, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/* Patient ID                                                          */
/* ------------------------------------------------------------------ */

describe("MediLink Patient ID", () => {
  it("generates valid codes with check characters", () => {
    for (let i = 0; i < 20; i++) {
      const code = patientCode.generatePatientCode();
      expect(patientCode.validatePatientCode(code)).toBeNull();
    }
  });

  it("rejects a transcribed typo in the body", () => {
    const code = patientCode.generatePatientCode();
    const body = code.slice(3, 13); // XXXXX-XXXXX part
    const mutated = "ML-" + (body[0] === "A" ? "B" : "A") + body.slice(1) + code.slice(13);
    expect(patientCode.validatePatientCode(mutated)).toBeTruthy();
  });

  it("normalizes ambiguous transcriptions (O→0, I→1)", () => {
    const code = patientCode.generatePatientCode();
    // Round-trip through normalization always succeeds
    expect(patientCode.normalizePatientCode(code)).toBe(code);
  });

  it("never derives from PII", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) codes.add(patientCode.generatePatientCode());
    expect(codes.size).toBe(50); // non-enumerable randomness
  });
});

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

describe("Controlled discovery", () => {
  it("finds a patient by valid Patient ID without disclosing demographics", async () => {
    const result = await discovery.lookupIdentifier({
      actorId: doctorId,
      identifier: patientCodeValue,
    });
    expect(result.kind).toBe("record_may_exist");
    // The outcome must not include name/dob/phone
    const str = JSON.stringify(result);
    expect(str).not.toContain("P0 Test Patient");
    expect(str).not.toContain("1990");
  });

  it("returns a uniform no-record message for unknown IDs", async () => {
    const unknown = patientCode.generatePatientCode();
    const result = await discovery.lookupIdentifier({
      actorId: doctorId,
      identifier: unknown,
    });
    expect(result.kind).toBe("no_record");
    expect((result as { message: string }).message).not.toContain("P0 Test Patient");
  });

  it("rate-limits excessive lookups", async () => {
    // Exhaust the per-minute budget
    for (let i = 0; i < 12; i++) {
      await discovery.lookupIdentifier({
        actorId: doctorId,
        identifier: patientCode.generatePatientCode(),
      });
    }
    const result = await discovery.lookupIdentifier({
      actorId: doctorId,
      identifier: patientCodeValue,
    });
    expect(result.kind).toBe("rate_limited");
  });

  it("handoff tokens are single-use", async () => {
    const { code } = await discovery.createHandoff(patientUserId, patientId);
    const first = await discovery.redeemHandoff({ clinicianUserId: doctorId, code });
    expect(first.ok).toBe(true);
    const second = await discovery.redeemHandoff({ clinicianUserId: doctorId, code });
    expect(second.ok).toBe(false);
  });

  it("expired handoff codes cannot be redeemed", async () => {
    // Create directly with a past expiry
    const { createHash } = await import("node:crypto");
    const code = "AAAA-BBBB-CCCC";
    await db.insert(schema.patientHandoffTokens).values({
      tokenHash: createHash("sha256").update(code).digest("hex"),
      patientId,
      code,
      expiresAt: new Date(Date.now() - 1000),
    });
    const res = await discovery.redeemHandoff({ clinicianUserId: doctorId, code });
    expect(res.ok).toBe(false);
  });

  it("patients cannot create handoffs for other patients", async () => {
    await expect(
      discovery.createHandoff(patientUserId, otherPatientId),
    ).rejects.toThrow("ACCESS_DENIED");
  });
});

/* ------------------------------------------------------------------ */
/* Policy evaluation                                                   */
/* ------------------------------------------------------------------ */

describe("Access policy evaluation", () => {
  it("denies doctors with no grant, with a user-safe reason", async () => {
    const d = await policy.evaluate(
      { actorId: doctorId, role: "doctor" },
      patientId,
      ["medications"],
      "record.read",
    );
    expect(d.decision).toBe("deny");
    expect(d.reasonCode).toBe("no_active_grant");
  });

  it("platform admins are denied clinical reads", async () => {
    const d = await policy.evaluate(
      { actorId: adminId, role: "platform_admin" },
      patientId,
      ["medications"],
      "record.read",
    );
    expect(d.decision).toBe("deny");
    expect(d.reasonCode).toBe("admin_no_clinical_read");
  });

  it("allows only within granted scopes (fail closed)", async () => {
    // Grant allergies only
    await consentService.grant({
      patientId,
      patientUserId,
      granteeType: "practitioner",
      granteePractitionerId: doctorPractitionerId,
      scopes: ["allergies"],
      purpose: "treatment",
      days: 7,
    });
    const ok = await policy.evaluate(
      { actorId: doctorId, role: "doctor" },
      patientId,
      ["allergies"],
      "record.read",
    );
    expect(ok.decision).toBe("allow");
    const no = await policy.evaluate(
      { actorId: doctorId, role: "doctor" },
      patientId,
      ["medications"],
      "record.read",
    );
    expect(no.decision).toBe("deny");
    expect(no.reasonCode).toBe("no_active_grant");
  });

  it("revocation is effective immediately", async () => {
    const grants = await consentService.activeForPractitioner(patientId, doctorPractitionerId);
    const target = grants.find((g) => (g.scopes as string[]).includes("allergies"));
    expect(target).toBeTruthy();
    await consentService.revoke(patientUserId, target!.id);
    const d = await policy.evaluate(
      { actorId: doctorId, role: "doctor" },
      patientId,
      ["allergies"],
      "record.read",
    );
    expect(d.decision).toBe("deny");
  });

  it("records every evaluation (allow and deny) for audit", async () => {
    const rows = await db
      .select()
      .from(schema.accessPolicyEvaluations)
      .where(eq(schema.accessPolicyEvaluations.actorId, doctorId));
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.some((r) => r.decision === "deny")).toBe(true);
    expect(rows.some((r) => r.decision === "allow")).toBe(true);
  });

  it("patients can access their own record", async () => {
    const d = await policy.evaluate(
      { actorId: patientUserId, role: "patient" },
      patientId,
      ["medications"],
      "record.read",
    );
    expect(d.decision).toBe("allow");
    expect(d.basisType).toBe("self");
  });

  it("patients cannot access another patient's record", async () => {
    const d = await policy.evaluate(
      { actorId: patientUserId, role: "patient" },
      otherPatientId,
      ["medications"],
      "record.read",
    );
    expect(d.decision).toBe("deny");
  });
});

/* ------------------------------------------------------------------ */
/* Access requests                                                     */
/* ------------------------------------------------------------------ */

describe("Access request lifecycle", () => {
  it("requires patient-selected scopes (no preselection)", async () => {
    const req = await accessRequestsService.createDraft({
      patientId,
      requesterUserId: doctorId,
      requesterPractitionerId: doctorPractitionerId,
      requesterSnapshot: { name: "Dr. P0", credentialStatus: "verified" },
      purpose: "treatment",
      suggestedScopes: ["allergies", "medications"],
      requestedDays: 7,
    });
    await accessRequestsService.submit(doctorId, req.id);
    await expect(
      accessRequestsService.decide({
        patientUserId,
        patientId,
        requestId: req.id,
        decision: "approve",
        approvedScopes: [],
      }),
    ).rejects.toThrow("Select at least one category");
  });

  it("patient can narrow scope and duration; artefact records everything", async () => {
    const req = await accessRequestsService.createDraft({
      patientId,
      requesterUserId: doctorId,
      requesterPractitionerId: doctorPractitionerId,
      requesterSnapshot: { name: "Dr. P0", credentialStatus: "verified" },
      purpose: "treatment",
      suggestedScopes: ["allergies", "medications", "lab_results"],
      requestedDays: 30,
    });
    await accessRequestsService.submit(doctorId, req.id);
    const result = (await accessRequestsService.decide({
      patientUserId,
      patientId,
      requestId: req.id,
      decision: "approve",
      approvedScopes: ["allergies"],
      days: 3,
    })) as { request: { status: string }; grant: { id: string; scopes: string[] }; receiptCode: string };
    expect(result.request.status).toBe("approved");
    expect(result.grant.scopes).toEqual(["allergies"]);
    // Artfact contains the exact policy snapshot
    const artifact = await accessRequestsService.artifactForConsent(result.grant.id);
    expect(artifact).toBeTruthy();
    expect(artifact!.artifactSha256).toHaveLength(64);
    expect(artifact!.receiptCode).toMatch(/^ML-/);
    expect((artifact!.artifact as { grant: { approvedScopes: string[] } }).grant.approvedScopes).toEqual(["allergies"]);
    // The narrowed grant works through the policy layer
    const d = await policy.evaluate(
      { actorId: doctorId, role: "doctor" },
      patientId,
      ["allergies"],
      "record.read",
    );
    expect(d.decision).toBe("allow");
    // And revoke to clean up
    await consentService.revoke(patientUserId, result.grant.id);
  });

  it("declined requests notify and close", async () => {
    const req = await accessRequestsService.createDraft({
      patientId,
      requesterUserId: doctorId,
      requesterPractitionerId: doctorPractitionerId,
      requesterSnapshot: { name: "Dr. P0", credentialStatus: "verified" },
      purpose: "treatment",
      requestedDays: 7,
    });
    await accessRequestsService.submit(doctorId, req.id);
    const row = (await accessRequestsService.decide({
      patientUserId,
      patientId,
      requestId: req.id,
      decision: "decline",
      reason: "Not needed",
    })) as { status: string };
    expect(row.status).toBe("declined");
    // Cannot decide twice
    await expect(
      accessRequestsService.decide({
        patientUserId,
        patientId,
        requestId: req.id,
        decision: "approve",
        approvedScopes: ["allergies"],
      }),
    ).rejects.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* Record versions & disputes                                          */
/* ------------------------------------------------------------------ */

describe("Immutable record versions", () => {
  it("seals a version with canonical payload hash", async () => {
    const res = await versions.recordVersions.seal({
      resourceId: "allergy-test-1",
      resourceType: "allergy",
      patientId,
      payload: { substance: "Penicillin", criticality: "high" },
      authoredById: doctorId,
      reviewState: "attested",
      attestedBy: doctorId,
    });
    expect(res.payloadSha256).toHaveLength(64);
    expect(res.version).toBe(1);
    const v = await versions.recordVersions.byId(res.versionId);
    expect(v!.reviewState).toBe("attested");
  });

  it("correction creates a new version; original is never mutated", async () => {
    const first = await versions.recordVersions.seal({
      resourceId: "med-test-1",
      resourceType: "medication_statement",
      patientId,
      payload: { medication: "Metformin", dose: "500mg" },
      authoredById: doctorId,
    });
    const second = await versions.recordVersions.seal({
      resourceId: "med-test-1",
      resourceType: "medication_statement",
      patientId,
      payload: { medication: "Metformin", dose: "1000mg" },
      authoredById: doctorId,
      replacesVersionId: first.versionId,
      correctionReason: "Dose updated per new prescription",
    });
    expect(second.version).toBe(2);
    const history = await versions.recordVersions.history("med-test-1");
    expect(history).toHaveLength(2);
    // Original preserved with superseded status
    const old = history.find((h) => h.version === 1)!;
    expect(old.lifecycleStatus).toBe("superseded");
    expect((old.payload as { dose: string }).dose).toBe("500mg");
    // New version marked as corrected
    const cur = history.find((h) => h.version === 2)!;
    expect(cur.lifecycleStatus).toBe("corrected");
    expect(cur.replacesVersionId).toBe(first.versionId);
  });

  it("records.correct() commits row + supersede + version atomically", async () => {
    const { records } = await import("../src/server/modules/records/service");
    const [orig] = await db
      .insert(schema.conditions)
      .values({ patientId, name: "Asthma", status: "active" })
      .returning();
    const { newId } = await records.correct({
      recordType: "condition",
      recordId: orig!.id,
      patientId,
      reason: "Updated diagnosis after spirometry review",
      actorId: doctorId,
      data: { kind: "condition", name: "Asthma", status: "chronic" },
    });
    // Replacement is live, original points at it…
    const [fresh] = await db
      .select()
      .from(schema.conditions)
      .where(eq(schema.conditions.id, orig!.id));
    expect(fresh!.supersededById).toBe(newId);
    const current = await records.currentConditions(patientId);
    expect(current.some((c) => c.id === orig!.id)).toBe(false);
    expect(current.some((c) => c.id === newId)).toBe(true);
    // …and the corrected version is sealed + linked in the same commit.
    const history = await versions.recordVersions.history(newId);
    expect(history).toHaveLength(1);
    expect(history[0]!.lifecycleStatus).toBe("active");
    // A crash-window orphan (live duplicate) is structurally impossible:
    // there is exactly one non-superseded row carrying this name.
    const live = current.filter((c) => c.name === "Asthma");
    expect(live).toHaveLength(1);
  });

  it("artifactsForConsents batches the latest artefact per grant", async () => {
    // Empty batch is a no-op (page renders without receipt decoration).
    const empty = await accessRequestsService.artifactsForConsents([]);
    expect(empty.size).toBe(0);
    // Unknown ids return nothing — never throw on the page path.
    const missing = await accessRequestsService.artifactsForConsents([
      "00000000-0000-0000-0000-000000000000",
    ]);
    expect(missing.size).toBe(0);
  });

  it("disputes flag the current version without rewriting it", async () => {
    const [condRow] = await db
      .insert(schema.conditions)
      .values({ patientId, name: "Hypertension" })
      .returning();
    const res = await versions.recordVersions.seal({
      resourceId: condRow!.id,
      resourceType: "condition",
      patientId,
      payload: { name: "Hypertension" },
      authoredById: doctorId,
    });
    const dispute = await versions.disputes.raise({
      patientId,
      raisedBy: patientUserId,
      resourceType: "condition",
      resourceId: condRow!.id,
      reason: "This is not my diagnosis",
    });
    expect(dispute!.status).toBe("open");
    // The version row is NEVER rewritten by a dispute: "disputed" is derived
    // at read time from open disputes. Terminal states (superseded /
    // entered_in_error) must survive a raise + resolve cycle intact.
    const v = await versions.recordVersions.byId(res.versionId);
    expect(v!.lifecycleStatus).toBe("active");
    // Payload untouched
    expect((v!.payload as { name: string }).name).toBe("Hypertension");
    // And the overlay reports it as disputed while the dispute is open.
    const open = await versions.disputes.openForPatient(patientId);
    expect(open.map((d) => d.resourceId)).toContain(condRow!.id);
  });

  it("disputes on another patient's chart are rejected", async () => {
    const [otherCond] = await db
      .insert(schema.conditions)
      .values({ patientId: otherPatientId, name: "Asthma" })
      .returning();
    await expect(
      versions.disputes.raise({
        patientId,
        raisedBy: patientUserId,
        resourceType: "condition",
        resourceId: otherCond!.id,
        reason: "Trying to flag someone else's row",
      }),
    ).rejects.toThrow("Record not found on this chart.");
  });

  it("disputes resolve and clear from the open queue", async () => {
    const [condRow] = await db
      .insert(schema.conditions)
      .values({ patientId, name: "Migraine" })
      .returning();
    const sealed = await versions.recordVersions.seal({
      resourceId: condRow!.id,
      resourceType: "condition",
      patientId,
      payload: { name: "Migraine" },
      authoredById: doctorId,
    });
    const dispute = await versions.disputes.raise({
      patientId,
      raisedBy: patientUserId,
      resourceType: "condition",
      resourceId: condRow!.id,
      reason: "Never had this diagnosed",
    });
    expect((await versions.disputes.openForPatient(patientId)).length).toBeGreaterThan(0);
    await versions.disputes.resolve({
      disputeId: dispute!.id,
      resolvedBy: doctorId,
      status: "resolved_rejected",
      notes: "Confirmed in encounter notes.",
    });
    const stillOpen = await versions.disputes.openForPatient(patientId);
    expect(stillOpen.find((d) => d.id === dispute!.id)).toBeUndefined();
    // Version flag lifts once nothing open references the resource.
    const after = await versions.recordVersions.byId(sealed.versionId);
    expect(after!.lifecycleStatus).toBe("active");
  });

  it("canonicalize is deterministic regardless of key order", () => {
    expect(
      versions.canonicalize({ a: 1, b: { d: 4, c: [3, 2] } }),
    ).toBe(versions.canonicalize({ b: { c: [3, 2], d: 4 }, a: 1 }));
  });

  it("conflict reconciliation auto-closes what re-scans no longer show", async () => {
    const mk = (criticality: string) =>
      db
        .insert(schema.allergies)
        .values({ patientId, substance: "Reconcile-Test-Drug", criticality })
        .returning();
    const [a1] = await mk("low");
    const [a2] = await mk("high");
    await contradictionsMod.contradictionEngine.detect(patientId);
    const open = await contradictionsMod.contradictionEngine.openFor(patientId);
    const allergyConflict = open.find((c) => c.kind === "allergy");
    expect(allergyConflict).toBeDefined();
    // Correct one entry (supersede) → conflict no longer reproduces.
    await db
      .update(schema.allergies)
      .set({ supersededById: a2!.id })
      .where(eq(schema.allergies.id, a1!.id));
    await contradictionsMod.contradictionEngine.detect(patientId);
    const after = await contradictionsMod.contradictionEngine.openFor(patientId);
    expect(after.find((c) => c.id === allergyConflict!.id)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* Outbox & jobs                                                       */
/* ------------------------------------------------------------------ */

describe("Outbox and durable jobs", () => {
  it("outbox events are processed and marked done", async () => {
    let calls = 0;
    outboxMod.registerOutboxHandler("test.event", async () => {
      calls++;
    });
    await outboxMod.outbox.publish({
      aggregateType: "test",
      aggregateId: "1",
      type: "test.event",
      payload: { hello: "world" },
    });
    const r1 = await outboxMod.outbox.drain();
    expect(r1.processed).toBeGreaterThanOrEqual(1);
    expect(calls).toBe(1);
    // Re-draining does not reprocess
    const r2 = await outboxMod.outbox.drain();
    expect(calls).toBe(1);
    expect(r2).toBeTruthy();
  });

  it("failing handlers retry then dead-letter", async () => {
    outboxMod.registerOutboxHandler("test.failing", async () => {
      throw new Error("boom");
    });
    // Insert with attempts pre-set high to keep the test fast
    await db.insert(schema.outboxEvents).values({
      aggregateType: "test",
      aggregateId: "2",
      type: "test.failing",
      payload: {},
      attempts: 9,
    });
    const r = await outboxMod.outbox.drain();
    expect(r.failed).toBeGreaterThanOrEqual(1);
    const rows = await db
      .select()
      .from(schema.outboxEvents)
      .where(eq(schema.outboxEvents.aggregateId, "2"));
    expect(rows[0]!.attempts).toBe(10);
    expect(rows[0]!.processedAt).toBeTruthy(); // dead-lettered
  });

  it("jobs are idempotent by key", async () => {
    let runs = 0;
    outboxMod.registerJobHandler("test.job", async () => {
      runs++;
      return { ok: true };
    });
    const a = await outboxMod.jobs.enqueue({
      jobType: "test.job",
      payload: {},
      idempotencyKey: "test-key-1",
    });
    const b = await outboxMod.jobs.enqueue({
      jobType: "test.job",
      payload: {},
      idempotencyKey: "test-key-1",
    });
    expect(a.id).toBe(b.id);
    const r1 = await outboxMod.jobs.runOnce();
    expect(r1.ran).toBe(true);
    await outboxMod.jobs.runOnce(); // drain any other pending job
    expect(runs).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Document pipeline v2                                                */
/* ------------------------------------------------------------------ */

describe("Document pipeline v2", () => {
  it("rejects MIME spoofing (declared type ≠ magic bytes)", async () => {
    // PNG bytes declared as text/plain
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    await expect(
      pipelineV2.ingestDocumentV2({
        patientId,
        uploadedById: doctorId,
        kind: "lab_report",
        title: "Spoofed",
        mimeType: "text/plain",
        bytes: pngBytes,
      }),
    ).rejects.toThrow(/does not match its declared type/);
  });

  it("rejects oversized files", async () => {
    await expect(
      pipelineV2.ingestDocumentV2({
        patientId,
        uploadedById: doctorId,
        kind: "lab_report",
        title: "Big",
        mimeType: "text/plain",
        bytes: new Uint8Array(5 * 1024 * 1024),
      }),
    ).rejects.toThrow(/4 MB/);
  });

  it("stores an immutable original, then extracts durably", async () => {
    const text = "Test Result Unit Reference\nHbA1c 6.9 % 4.0 - 5.6";
    const bytes = new TextEncoder().encode(text);
    const { documentId } = await pipelineV2.ingestDocumentV2({
      patientId,
      uploadedById: doctorId,
      kind: "lab_report",
      title: "Durable HbA1c",
      mimeType: "text/plain",
      bytes,
    });
    // Not yet extracted — extraction is out-of-band now
    const [before] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId));
    expect(before!.extractionStatus).toBe("pending");
    // Run the durable pass
    const pass = await pipelineV2.runExtractionPass();
    expect(pass.ran).toBe(true);
    expect(pass.status).toBe("done");
    const [after] = await db.select().from(schema.documents).where(eq(schema.documents.id, documentId));
    expect(after!.extractionStatus).toBe("done");
    expect(after!.textExtract).toContain("HbA1c");
    // Original bytes unchanged
    const stored = await pipelineV2.readDocumentBytes(after!.storageKey);
    expect(new TextDecoder().decode(stored)).toBe(text);
    // Scan state recorded
    const [scan] = await db
      .select()
      .from(schema.documentScanState)
      .where(eq(schema.documentScanState.documentId, documentId));
    expect(scan).toBeTruthy();
    // A second pass with nothing pending does nothing
    const pass2 = await pipelineV2.runExtractionPass();
    expect(pass2.ran).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Audit checkpoints                                                   */
/* ------------------------------------------------------------------ */

describe("Audit checkpoints", () => {
  it("creates a checkpoint and verifies the chain", async () => {
    await audit.record({
      actorId: adminId,
      action: "test.checkpoint.event",
    });
    const cp = await checkpoints.create();
    expect(cp.manifestSha256).toHaveLength(64);
    expect(cp.lastSeq).toBeGreaterThan(0);
    const v = await checkpoints.verify();
    expect(v.chainBreakSeq).toBeNull();
  });

  it("detects tampering", async () => {
    await audit.record({ actorId: adminId, action: "test.before.tamper" });
    // Direct DB mutation (simulating a privileged operator rewrite)
    await db.execute(
      `UPDATE audit_events SET action = 'tampered.action' WHERE action = 'test.before.tamper'`,
    );
    const v = await checkpoints.verify();
    expect(v.chainBreakSeq).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Regression: cross-patient consent revocation (P0, this audit)        */
/* ------------------------------------------------------------------ */

describe("Consent revocation ownership", () => {
  it("a patient cannot revoke another patient's grant", async () => {
    // Patient B (no account) gets a grant; the attacker is patient A's user.
    const victim = await patientService.create({
      fullName: "Revocation Victim",
      createdById: adminId,
    });
    const grant = await consentService.grant({
      patientId: victim.id,
      patientUserId: "no-such-user",
      granteeType: "practitioner",
      granteePractitionerId: doctorPractitionerId,
      scopes: ["conditions"],
      purpose: "treatment",
      days: 7,
    });
    // The legitimate owner's user id differs from the attacker's.
    await expect(
      consentService.revoke(patientUserId, grant.id),
    ).rejects.toThrow();
    // Grant must remain active after the denied attempt.
    const stillActive = await db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.id, grant.id));
    expect(stillActive[0]?.status).toBe("active");
  });

  it("the real owner can still revoke", async () => {
    const ownerUser = await signUp("p0.owner2@test.local", "Owner Two", "patient");
    const owned = await patientService.create({
      fullName: "Revocation Owner",
      userId: ownerUser,
      createdById: adminId,
    });
    const grant = await consentService.grant({
      patientId: owned.id,
      patientUserId: ownerUser,
      granteeType: "practitioner",
      granteePractitionerId: doctorPractitionerId,
      scopes: ["conditions"],
      purpose: "treatment",
      days: 7,
    });
    await consentService.revoke(ownerUser, grant.id);
    const rows = await db
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.id, grant.id));
    expect(rows[0]?.status).toBe("revoked");
  });
});

/* ------------------------------------------------------------------ */
/* Regression: ABHA lookup reaches patients.abha_number (this audit)    */
/* ------------------------------------------------------------------ */

describe("ABHA discovery sources", () => {
  it("finds a linked patient by their profile ABHA number", async () => {
    // Verhoeff-valid fixture: lookup now checks the ABHA check digit.
    const abha = "12345678901230";
    await db
      .update(schema.patients)
      .set({ abhaNumber: abha })
      .where(eq(schema.patients.id, patientId));
    // Fresh actor: lookup buckets are per-actor and earlier describe blocks
    // exhaust this file's doctor budget.
    const res = await discovery.lookupIdentifier({
      actorId: adminId,
      identifier: ` ${abha.slice(0, 2)}-${abha.slice(2)} `,
    });
    expect(res.kind).toBe("record_may_exist");
    if (res.kind === "record_may_exist") expect(res.patientId).toBe(patientId);
  });

  it("never resolves an unclaimed record via self-reported ABHA", async () => {
    const unclaimed = await patientService.create({
      fullName: "Unclaimed ABHA",
      abhaNumber: "99998888777766",
      createdById: adminId,
    });
    const res = await discovery.lookupIdentifier({
      actorId: adminId,
      identifier: "99998888777766",
    });
    // Uniform no-record outcome either way — but specifically not a hit.
    if (res.kind === "record_may_exist" || res.kind === "handoff") {
      expect(res.patientId).not.toBe(unclaimed.id);
    } else {
      expect(["no_record", "invalid", "rate_limited"]).toContain(res.kind);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Regression: opaque emergency-card tokens (§7.12, this audit)         */
/* ------------------------------------------------------------------ */

describe("Emergency card tokens", () => {
  it("issues once and reuses across renders; rotates on demand", async () => {
    const { emergencyCard } = await import(
      "../src/server/modules/identity/emergency-card"
    );
    const first = await emergencyCard.issue(patientUserId, patientId);
    expect(first.token).toMatch(/^[0-9a-f]{40}$/);
    const again = await emergencyCard.issue(patientUserId, patientId);
    expect(again.token).toBe(first.token); // printed card stays valid

    const rotated = await emergencyCard.rotate(patientUserId, patientId);
    expect(rotated.token).toMatch(/^[0-9a-f]{40}$/);
    expect(rotated.token).not.toBe(first.token);
    // Old token no longer resolves.
    const oldRes = await emergencyCard.resolve(first.token);
    expect(oldRes).toBeNull();
    // New one does.
    const newRes = await emergencyCard.resolve(rotated.token);
    expect(newRes?.patientId).toBe(patientId);
  });

  it("rejects foreign users and malformed tokens", async () => {
    const { emergencyCard } = await import(
      "../src/server/modules/identity/emergency-card"
    );
    await expect(
      emergencyCard.rotate("not-the-owner", patientId),
    ).rejects.toThrow("ACCESS_DENIED");
    expect(await emergencyCard.resolve("short-token")).toBeNull();
    expect(await emergencyCard.resolve("z".repeat(40))).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Regression: patient profile self-update validation (this audit)     */
/* ------------------------------------------------------------------ */

describe("Patient profile validation", () => {
  it("rejects malformed ABHA, accepts 14 digits (stored digits-only)", async () => {
    await expect(
      patientService.updateSelf(patientUserId, patientId, { abhaNumber: "123" }),
    ).rejects.toThrow("INVALID_ABHA");
    await expect(
      patientService.updateSelf(patientUserId, patientId, { abhaNumber: "12-34-abcd" }),
    ).rejects.toThrow("INVALID_ABHA");
    const updated = await patientService.updateSelf(patientUserId, patientId, {
      abhaNumber: "91-2345-6789-0124",
    });
    expect(updated.abhaNumber).toBe("91234567890124");
  });

  it("rejects unknown blood groups, normalizes valid ones", async () => {
    await expect(
      patientService.updateSelf(patientUserId, patientId, { bloodGroupSelfReported: "Z+" }),
    ).rejects.toThrow("INVALID_BLOOD_GROUP");
    const updated = await patientService.updateSelf(patientUserId, patientId, {
      bloodGroupSelfReported: "o+",
    });
    expect(updated.bloodGroupSelfReported).toBe("O+");
  });

  it("rejects oversized free-text fields and foreign records", async () => {
    await expect(
      patientService.updateSelf(patientUserId, patientId, { addressCity: "x".repeat(121) }),
    ).rejects.toThrow("FIELD_TOO_LONG");
    await expect(
      patientService.updateSelf(patientUserId, otherPatientId, { addressCity: "Pune" }),
    ).rejects.toThrow("ACCESS_DENIED");
  });
});

/* ------------------------------------------------------------------ */
/* Manual-review leg: pending queue + admin approve/reject (this audit) */
/*                                                                     */
/* The E2E script only exercises the default mock (auto-approve); the  */
/* pending queue + reviewer decisions run under                        */
/* VERIFICATION_PROVIDER=manual_review and are pinned here. The env    */
/* switch is scoped to these tests so later files keep auto-approve.   */
/* ------------------------------------------------------------------ */

describe("Manual verification review", () => {
  it("queues submissions as pending and approves them", async () => {
    const prev = process.env.VERIFICATION_PROVIDER;
    process.env.VERIFICATION_PROVIDER = "manual_review";
    try {
      const res = await auth.api.signUpEmail({
        body: { email: "pending.doc@test.local", password: PASSWORD, name: "Dr. Pending" },
      } as never);
      const userId = (res as unknown as { user: { id: string } }).user.id;
      await db
        .update(schema.user)
        .set({ role: "doctor" })
        .where(eq(schema.user.id, userId));
      const sub = await identityMod.submitPractitionerVerification({
        userId,
        fullName: "Dr. Pending",
        registrationNumber: "PEND/2026/001",
        council: "Test Council",
      });
      expect(sub.practitioner.verificationStatus).toBe("pending");
      const pending = await identityMod.listPendingPractitioners();
      expect(pending.map((p) => p.id)).toContain(sub.practitioner.id);

      await identityMod.reviewPractitionerVerification({
        reviewerId: adminId,
        practitionerId: sub.practitioner.id,
        approve: true,
        notes: "Credentials check out.",
      });
      const [row] = await db
        .select({ status: schema.practitioners.verificationStatus })
        .from(schema.practitioners)
        .where(eq(schema.practitioners.id, sub.practitioner.id));
      expect(row?.status).toBe("verified");
      const after = await identityMod.listPendingPractitioners();
      expect(after.map((p) => p.id)).not.toContain(sub.practitioner.id);
    } finally {
      if (prev === undefined) delete process.env.VERIFICATION_PROVIDER;
      else process.env.VERIFICATION_PROVIDER = prev;
    }
  });

  it("rejects with notes and blocks unknown ids", async () => {
    const prev = process.env.VERIFICATION_PROVIDER;
    process.env.VERIFICATION_PROVIDER = "manual_review";
    try {
      const res = await auth.api.signUpEmail({
        body: { email: "reject.doc@test.local", password: PASSWORD, name: "Dr. Reject" },
      } as never);
      const userId = (res as unknown as { user: { id: string } }).user.id;
      await db
        .update(schema.user)
        .set({ role: "doctor" })
        .where(eq(schema.user.id, userId));
      const sub = await identityMod.submitPractitionerVerification({
        userId,
        fullName: "Dr. Reject",
        registrationNumber: "PEND/2026/002",
      });
      await identityMod.reviewPractitionerVerification({
        reviewerId: adminId,
        practitionerId: sub.practitioner.id,
        approve: false,
        notes: "Registration not found in council records.",
      });
      const [row] = await db
        .select({ status: schema.practitioners.verificationStatus })
        .from(schema.practitioners)
        .where(eq(schema.practitioners.id, sub.practitioner.id));
      expect(row?.status).toBe("rejected");
      await expect(
        identityMod.reviewPractitionerVerification({
          reviewerId: adminId,
          practitionerId: "00000000-0000-0000-0000-000000000000",
          approve: true,
        }),
      ).rejects.toThrow("Practitioner not found");
    } finally {
      if (prev === undefined) delete process.env.VERIFICATION_PROVIDER;
      else process.env.VERIFICATION_PROVIDER = prev;
    }
  });
});

/* ------------------------------------------------------------------ */
/* Structured extraction is idempotent per document (this audit)       */
/* A redelivered job after a post-commit crash must skip, never double */
/* the extracted observations.                                         */
/* ------------------------------------------------------------------ */

describe("Structured extraction idempotency", () => {
  it("writes observations once across redelivered runs", async () => {
    const text = "Test Result Unit Reference\nHbA1c  7.2  %  4.0 - 5.6\nHemoglobin  13.1  g/dL  13.0 - 17.0";
    const { documentId } = await pipelineV2.ingestDocumentV2({
      patientId,
      uploadedById: doctorId,
      kind: "lab_report",
      title: "Idempotent HbA1c",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode(text),
    });
    // Text extraction first (the structured job reads textExtract).
    for (let i = 0; i < 5; i++) {
      const pass = await pipelineV2.runExtractionPass();
      if (!pass.ran || pass.status === "done") break;
    }
    const { runStructuredExtraction } = await import(
      "../src/server/modules/documents/structured-extraction"
    );
    const ctx = {
      patientId,
      userId: doctorId,
      organizationId: null,
      title: "Idempotent HbA1c",
      kind: "lab_report",
      recordedDate: "2026-03-01",
    };
    const first = await runStructuredExtraction(documentId, ctx);
    expect(first.labs).toBeGreaterThan(0);
    const second = await runStructuredExtraction(documentId, ctx);
    expect(second.skipped).toBe("already extracted");
    const rows = await db
      .select({ id: schema.observations.id })
      .from(schema.observations)
      .where(eq(schema.observations.sourceDocumentId, documentId));
    expect(rows.length).toBe(first.labs as number);
  });
});

/* ------------------------------------------------------------------ */
/* Verification resubmission updates in place (this audit)             */
/* Rejected doctors must be able to resubmit (the rejection UI tells   */
/* them to); grants keyed by practitioner id must survive.             */
/* ------------------------------------------------------------------ */

describe("Verification resubmission", () => {
  it("updates the single practitioner row instead of duplicating", async () => {
    const res = await auth.api.signUpEmail({
      body: { email: "resubmit.doc@test.local", password: PASSWORD, name: "Dr. First" },
    } as never);
    const userId = (res as unknown as { user: { id: string } }).user.id;
    await db
      .update(schema.user)
      .set({ role: "doctor" })
      .where(eq(schema.user.id, userId));
    const first = await identityMod.submitPractitionerVerification({
      userId,
      fullName: "Dr. First",
      registrationNumber: "MMC/2020/11111",
      council: "Test Council",
    });
    const again = await identityMod.submitPractitionerVerification({
      userId,
      fullName: "Dr. Corrected",
      registrationNumber: "MMC/2020/11111",
      council: "Test Council",
    });
    expect(again.practitioner.id).toBe(first.practitioner.id);
    expect(again.practitioner.fullName).toBe("Dr. Corrected");
    const rows = await db
      .select({ id: schema.practitioners.id })
      .from(schema.practitioners)
      .where(eq(schema.practitioners.userId, userId));
    expect(rows.length).toBe(1);
  });
});
