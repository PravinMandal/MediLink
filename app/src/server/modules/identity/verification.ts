/**
 * Identity & verification module.
 *
 * Trust boundary: a doctor/lab cannot contribute records until verified.
 * Verification itself sits behind the VerificationProvider adapter so
 * development runs on Mock, production can run ManualReview, and an
 * HPR/HFR (ABDM) adapter can be added without touching business code.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  organizations,
  organizationVerifications,
  practitioners,
  practitionerVerifications,
  user as users,
} from "@/server/db/schema";
import { audit } from "@/server/modules/audit/service";
import { notify } from "@/server/modules/notifications/service";

export type ProviderDecision = {
  outcome: "auto_approved" | "needs_manual_review" | "rejected";
  notes?: string;
};

export interface VerificationProvider {
  readonly name: string;
  verifyPractitioner(input: {
    fullName: string;
    registrationNumber: string;
    council?: string | null;
    qualification?: string | null;
  }): Promise<ProviderDecision>;
  verifyOrganization(input: {
    name: string;
    type: string;
    registrationNumber?: string | null;
    city?: string | null;
  }): Promise<ProviderDecision>;
}

/**
 * Mock provider — auto-approves anything with plausible shape. Used in local
 * development and demos so the full pipeline can run without external
 * registries.
 */
export const MockVerificationProvider: VerificationProvider = {
  name: "mock",
  async verifyPractitioner(input) {
    const ok = /^[A-Za-z]{2,}\d{2,}/.test(input.registrationNumber) || input.registrationNumber.length >= 4;
    return ok
      ? { outcome: "auto_approved", notes: "Mock registry match" }
      : { outcome: "rejected", notes: "Registration number looks invalid" };
  },
  async verifyOrganization(input) {
    return input.name.length >= 3
      ? { outcome: "auto_approved", notes: "Mock registry match" }
      : { outcome: "rejected", notes: "Organization name too short" };
  },
};

/**
 * Manual review provider — everything lands in the platform-admin queue.
 * The realistic default for a production deployment without registry API
 * access.
 */
export const ManualReviewProvider: VerificationProvider = {
  name: "manual_review",
  async verifyPractitioner() {
    return { outcome: "needs_manual_review" };
  },
  async verifyOrganization() {
    return { outcome: "needs_manual_review" };
  },
};

export function getVerificationProvider(): VerificationProvider {
  // Fail closed: production defaults to manual review. The mock provider
  // auto-approves reg.length >= 4 and must be opted into explicitly
  // (local dev / demo / tests only) — never by accident.
  switch (process.env.VERIFICATION_PROVIDER) {
    case "mock":
      if (process.env.NODE_ENV === "production") {
        throw new Error("VERIFICATION_PROVIDER=mock is forbidden in production.");
      }
      return MockVerificationProvider;
    case "manual_review":
    default:
      return ManualReviewProvider;
  }
}

/** ABDM adapter placeholder — implements the same interface once sandbox V3
 *  credentials exist. Kept explicit so the seam is visible. */
export const AbdmRegistryProvider: VerificationProvider = {
  name: "abdm_hpr_hfr",
  async verifyPractitioner() {
    throw new Error("ABDM HPR verification not configured (sandbox spike pending)");
  },
  async verifyOrganization() {
    throw new Error("ABDM HFR verification not configured (sandbox spike pending)");
  },
};

/* ------------------------------------------------------------------ */
/* Practitioner flows                                                  */
/* ------------------------------------------------------------------ */

export async function submitPractitionerVerification(input: {
  userId: string;
  fullName: string;
  registrationNumber: string;
  council?: string;
  qualification?: string;
  specialty?: string;
  organizationId?: string | null;
}) {
  const provider = getVerificationProvider();
  const decision = await provider.verifyPractitioner(input);
  const status =
    decision.outcome === "auto_approved" ? "verified" : "pending";

  // Resubmission updates the single practitioner row in place (userId is
  // unique): rejected doctors can resubmit corrected details as the UI
  // promises, and consent grants (keyed by practitioner id) survive.
  // New claims re-enter review — verified access pauses until re-approved.
  const [existing] = await db
    .select({ id: practitioners.id })
    .from(practitioners)
    .where(eq(practitioners.userId, input.userId));
  const [practitioner] = existing
    ? await db
        .update(practitioners)
        .set({
          organizationId: input.organizationId ?? null,
          fullName: input.fullName,
          registrationNumber: input.registrationNumber,
          council: input.council,
          qualification: input.qualification,
          specialty: input.specialty,
          verificationStatus: status,
          verifiedAt: decision.outcome === "auto_approved" ? new Date() : null,
          verifiedBy: null,
        })
        .where(eq(practitioners.id, existing.id))
        .returning()
    : await db
        .insert(practitioners)
        .values({
          userId: input.userId,
          organizationId: input.organizationId ?? null,
          fullName: input.fullName,
          registrationNumber: input.registrationNumber,
          council: input.council,
          qualification: input.qualification,
          specialty: input.specialty,
          verificationStatus: status,
          verifiedAt: decision.outcome === "auto_approved" ? new Date() : null,
        })
        .returning();

  await db.insert(practitionerVerifications).values({
    practitionerId: practitioner.id,
    status:
      decision.outcome === "auto_approved" ? "verified" : "pending",
    notes: decision.notes,
    evidence: { provider: provider.name, input: { ...input, userId: undefined } },
  });

  if (decision.outcome === "auto_approved") {
    await db
      .update(users)
      .set({ verificationStatus: "verified", updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  } else {
    await db
      .update(users)
      .set({ verificationStatus: "pending", updatedAt: new Date() })
      .where(eq(users.id, input.userId));
  }

  await audit.record({
    actorId: input.userId,
    actorRole: "doctor",
    action: "practitioner.verification.submitted",
    resourceType: "practitioner",
    resourceId: practitioner.id,
    metadata: {
      provider: provider.name,
      outcome: decision.outcome,
      resubmission: Boolean(existing),
    },
  });

  return { practitioner, decision };
}

export async function reviewPractitionerVerification(input: {
  reviewerId: string;
  practitionerId: string;
  approve: boolean;
  notes?: string;
}) {
  const [practitioner] = await db
    .select()
    .from(practitioners)
    .where(eq(practitioners.id, input.practitionerId));
  if (!practitioner) throw new Error("Practitioner not found");

  await db.transaction(async (tx) => {
    await tx
      .update(practitioners)
      .set({
        verificationStatus: input.approve ? "verified" : "rejected",
        verifiedAt: input.approve ? new Date() : null,
        verifiedBy: input.reviewerId,
      })
      .where(eq(practitioners.id, input.practitionerId));

    await tx.insert(practitionerVerifications).values({
      practitionerId: input.practitionerId,
      status: input.approve ? "verified" : "rejected",
      notes: input.notes,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
    });

    await tx
      .update(users)
      .set({
        verificationStatus: input.approve ? "verified" : "rejected",
        updatedAt: new Date(),
      })
      .where(eq(users.id, practitioner.userId));
  });

  await notify.push({
    userId: practitioner.userId,
    type: input.approve ? "verification.approved" : "verification.rejected",
    title: input.approve
      ? "Your practitioner verification was approved"
      : "Your practitioner verification was rejected",
    body: input.notes,
    link: "/portal/doctor",
  });

  await audit.record({
    actorId: input.reviewerId,
    actorRole: "platform_admin",
    action: input.approve
      ? "practitioner.verification.approved"
      : "practitioner.verification.rejected",
    resourceType: "practitioner",
    resourceId: input.practitionerId,
    reason: input.notes,
  });
}

/* ------------------------------------------------------------------ */
/* Organization flows                                                  */
/* ------------------------------------------------------------------ */

export async function createOrganization(input: {
  createdByUserId: string;
  name: string;
  type: (typeof organizations.$inferSelect)["type"];
  registrationNumber?: string;
  addressLine?: string;
  city?: string;
  state?: string;
}) {
  const provider = getVerificationProvider();
  const decision = await provider.verifyOrganization(input);

  const [org] = await db
    .insert(organizations)
    .values({
      name: input.name,
      type: input.type,
      registrationNumber: input.registrationNumber,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      verificationStatus:
        decision.outcome === "auto_approved" ? "verified" : "pending",
      verifiedAt: decision.outcome === "auto_approved" ? new Date() : null,
    })
    .returning();

  await db.insert(organizationVerifications).values({
    organizationId: org.id,
    submittedBy: input.createdByUserId,
    status: decision.outcome === "auto_approved" ? "verified" : "pending",
    notes: decision.notes,
    evidence: { provider: provider.name },
  });

  await audit.record({
    actorId: input.createdByUserId,
    action: "organization.created",
    resourceType: "organization",
    resourceId: org.id,
    metadata: { provider: provider.name, outcome: decision.outcome },
  });

  return { organization: org, decision };
}

export async function reviewOrganizationVerification(input: {
  reviewerId: string;
  organizationId: string;
  approve: boolean;
  notes?: string;
}) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, input.organizationId));
  if (!org) throw new Error("Organization not found");

  await db.transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({
        verificationStatus: input.approve ? "verified" : "rejected",
        verifiedAt: input.approve ? new Date() : null,
        verifiedBy: input.reviewerId,
      })
      .where(eq(organizations.id, input.organizationId));

    await tx.insert(organizationVerifications).values({
      organizationId: input.organizationId,
      status: input.approve ? "verified" : "rejected",
      notes: input.notes,
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
    });
  });

  await audit.record({
    actorId: input.reviewerId,
    actorRole: "platform_admin",
    action: input.approve
      ? "organization.verification.approved"
      : "organization.verification.rejected",
    resourceType: "organization",
    resourceId: input.organizationId,
    reason: input.notes,
  });

  return true;
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export async function getPractitionerForUser(userId: string) {
  const [row] = await db
    .select()
    .from(practitioners)
    .where(eq(practitioners.userId, userId));
  return row ?? null;
}

export async function listPendingPractitioners() {
  return db
    .select()
    .from(practitioners)
    .where(eq(practitioners.verificationStatus, "pending"))
    .orderBy(desc(practitioners.createdAt));
}

export async function listPendingOrganizations() {
  return db
    .select()
    .from(organizations)
    .where(eq(organizations.verificationStatus, "pending"))
    .orderBy(desc(organizations.createdAt));
}

export async function listVerifiedOrganizations() {
  return db
    .select()
    .from(organizations)
    .where(eq(organizations.verificationStatus, "verified"))
    .orderBy(organizations.name);
}

export async function joinOrganization(userId: string, organizationId: string) {
  await db
    .update(users)
    .set({ organizationId, updatedAt: new Date() })
    .where(eq(users.id, userId));
  const [p] = await db
    .select()
    .from(practitioners)
    .where(eq(practitioners.userId, userId));
  if (p) {
    await db
      .update(practitioners)
      .set({ organizationId })
      .where(eq(practitioners.id, p.id));
  }
}

export async function requireVerifiedPractitioner(userId: string) {
  const p = await getPractitionerForUser(userId);
  if (!p || p.verificationStatus !== "verified") {
    throw new Error("VERIFICATION_REQUIRED");
  }
  return p;
}

export async function requireVerifiedOrganization(organizationId: string | null | undefined) {
  if (!organizationId) throw new Error("ORGANIZATION_REQUIRED");
  const [org] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), eq(organizations.verificationStatus, "verified")));
  if (!org) throw new Error("ORGANIZATION_NOT_VERIFIED");
  return org;
}
