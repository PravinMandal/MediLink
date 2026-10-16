/**
 * Centralized access policy evaluation (BuildPlan §8.4).
 *
 * This is the single policy decision point: it consumes an AccessContext
 * (actor + session assurance + purpose) plus a target, and emits a
 * structured decision (allow / deny / step-up-required) with an access
 * basis, allowed scopes, a reason code for audit, and a user-safe
 * explanation. Every clinical read/write funnels through `evaluate`.
 *
 * The legacy `access.check` guard is retained as an input to this layer;
 * decisions are recorded in `access_policy_evaluations`.
 */
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import {
  emergencyAccessEvents,
  organizations,
  patientIdentityState,
  accessPolicyEvaluations,
} from "@/server/db/schema";
import {
  ALL_SCOPES,
  type ConsentScope,
  consent as consentService,
} from "@/server/modules/consent/service";
import { getPractitionerForUser } from "@/server/modules/identity/verification";

export const EMERGENCY_SCOPES: ConsentScope[] = [
  "demographics",
  "conditions",
  "allergies",
  "medications",
  "lab_results",
];

export const POLICY_VERSION = "v1";

export type AccessBasisType = "self" | "consent" | "emergency" | "none";

export type PolicyDecision = {
  decision: "allow" | "deny" | "step_up_required";
  basisType: AccessBasisType;
  basisId: string | null;
  scopes: ConsentScope[];
  reasonCode: string;
  explanation: string;
  correlationId: string;
};

export interface AccessContext {
  actorId: string;
  role: "patient" | "doctor" | "lab_staff" | "org_admin" | "platform_admin";
  organizationId?: string | null;
  /** Session assurance level; privileged/emergency actions require step-up. */
  sessionAssurance?: "standard" | "step_up";
  purpose?: string | null;
  correlationId?: string;
}

export class PolicyDeniedError extends Error {
  readonly decision: PolicyDecision;
  constructor(decision: PolicyDecision) {
    super(decision.reasonCode);
    this.name = "PolicyDeniedError";
    this.decision = decision;
  }
}

function deny(
  ctx: AccessContext,
  reasonCode: string,
  explanation: string,
): PolicyDecision {
  return {
    decision: "deny",
    basisType: "none",
    basisId: null,
    scopes: [],
    reasonCode,
    explanation,
    correlationId: ctx.correlationId ?? crypto.randomUUID(),
  };
}

/** Identity caution blocks high-risk reads/writes (BuildPlan §8.1). */
export async function identityCaution(patientId: string): Promise<string | null> {
  const [row] = await db
    .select({ state: patientIdentityState.state, reason: patientIdentityState.cautionReason })
    .from(patientIdentityState)
    .where(eq(patientIdentityState.patientId, patientId));
  if (!row) return null;
  if (row.state === "identity_caution" || row.state === "claim_pending") {
    return row.reason ?? "Patient identity requires review before this action.";
  }
  return null;
}

export const policy = {
  /**
   * Evaluate access for a clinical read/write. `wanted` scopes must ALL be
   * within the access basis; unknown scopes fail closed.
   */
  async evaluate(
    ctx: AccessContext,
    patientId: string,
    wanted: ConsentScope[] | "*",
    action: string,
  ): Promise<PolicyDecision> {
    const correlationId = ctx.correlationId ?? crypto.randomUUID();

    // --- Patient self-access ---
    if (ctx.role === "patient") {
      const { patients } = await import("@/server/db/schema");
      const [row] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.userId, ctx.actorId)));
      const d: PolicyDecision = row
        ? {
            decision: "allow",
            basisType: "self",
            basisId: patientId,
            scopes: [...ALL_SCOPES],
            reasonCode: "self_access",
            explanation: "You are viewing your own record.",
            correlationId,
          }
        : deny(ctx, "not_own_record", "This record is not linked to your account.");
      await record(d, ctx, patientId, action, wanted);
      return d;
    }

    // --- Platform admins: denied clinical reads; case evidence is a separate
    //     dual-authorized workflow, not this path. ---
    if (ctx.role === "platform_admin") {
      const d = deny(
        ctx,
        "admin_no_clinical_read",
        "Platform administrators cannot open clinical records through this path.",
      );
      await record(d, ctx, patientId, action, wanted);
      return d;
    }

    // --- Organization staff: org grants + staff membership ---
    if (ctx.role === "lab_staff" || ctx.role === "org_admin") {
      if (!ctx.organizationId) {
        const d = deny(ctx, "no_org_membership", "No active organization membership.");
        await record(d, ctx, patientId, action, wanted);
        return d;
      }
      // Same class as the practitioner gate below: a pending/rejected facility
      // must not read through grants, even with a membership row.
      const [org] = await db
        .select({ verificationStatus: organizations.verificationStatus })
        .from(organizations)
        .where(eq(organizations.id, ctx.organizationId));
      if (!org || org.verificationStatus !== "verified") {
        const d = deny(
          ctx,
          "organization_unverified",
          "Your facility's verification is still pending. Clinical access unlocks once it is approved.",
        );
        await record(d, ctx, patientId, action, wanted);
        return d;
      }
      // Identity caution blocks professional access pending review (§8.1).
      const caution = await identityCaution(patientId);
      if (caution) {
        const d = deny(
          ctx,
          "identity_caution",
          "This patient's identity is under review; access is paused for patient safety.",
        );
        await record(d, ctx, patientId, action, wanted);
        return d;
      }
      const grants = await consentService.activeForOrganization(
        patientId,
        ctx.organizationId,
      );
      const scopes = grants.flatMap((g) => g.scopes as ConsentScope[]);
      const d = matchScopes(ctx, scopes, grants[0]?.id ?? null, "consent", wanted, correlationId);
      await record(d, ctx, patientId, action, wanted);
      return d;
    }

    // --- Doctors: practitioner grant or emergency event ---
    if (ctx.role === "doctor") {
      // Identity caution blocks professional access pending review (§8.1).
      const caution = await identityCaution(patientId);
      if (caution) {
        const d = deny(
          ctx,
          "identity_caution",
          "This patient's identity is under review; access is paused for patient safety.",
        );
        await record(d, ctx, patientId, action, wanted);
        return d;
      }
      const practitioner = await getPractitionerForUser(ctx.actorId);
      if (!practitioner) {
        const d = deny(ctx, "no_practitioner_profile", "Practitioner profile missing or unverified.");
        await record(d, ctx, patientId, action, wanted);
        return d;
      }
      // P0: existence is not trust. Only a verified practitioner may read
      // through consent or emergency — self-registered, pending, or rejected
      // doctors are denied even when a stale grant names them.
      if (practitioner.verificationStatus !== "verified") {
        const d = deny(
          ctx,
          "practitioner_unverified",
          "Your clinician verification is still pending. Clinical access unlocks once it is approved.",
        );
        await record(d, ctx, patientId, action, wanted);
        return d;
      }
      const grants = await consentService.activeForPractitioner(
        patientId,
        practitioner.id,
      );
      const scopes = grants.flatMap((g) => g.scopes as ConsentScope[]);      if (wanted === "*" ? scopes.length > 0 : wanted.every((s) => scopes.includes(s))) {
        const d: PolicyDecision = {
          decision: "allow",
          basisType: "consent",
          basisId: grants[0]!.id,
          scopes,
          reasonCode: "consent_grant",
          explanation: "Access granted by the patient.",
          correlationId,
        };
        await record(d, ctx, patientId, action, wanted);
        return d;
      }

      const [emergency] = await db
        .select()
        .from(emergencyAccessEvents)
        .where(
          and(
            eq(emergencyAccessEvents.patientId, patientId),
            eq(emergencyAccessEvents.practitionerId, practitioner.id),
            gt(emergencyAccessEvents.expiresAt, new Date()),
            // A reviewed window is closed: only NULL/pending keep
            // authorizing. The old query let a reviewed event grant until
            // expiry, so a closed break-glass kept opening records.
            or(
              isNull(emergencyAccessEvents.reviewStatus),
              eq(emergencyAccessEvents.reviewStatus, "pending"),
            ),
          ),
        );
      if (emergency) {
        // Emergency reads ride break-glass: demand fresh step-up assurance.
        // The action layer confirms the password; the policy enforces the
        // result, so a standard session can never read through this path.
        if (ctx.sessionAssurance !== "step_up") {
          const d = deny(
            ctx,
            "step_up_required",
            "Emergency access requires re-entering your password to confirm it is you.",
          );
          await record(d, ctx, patientId, action, wanted);
          return d;
        }
        const ok =
          wanted === "*"
            ? true
            : wanted.every((s) => EMERGENCY_SCOPES.includes(s));
        const d: PolicyDecision = ok
          ? {
              decision: "allow",
              basisType: "emergency",
              basisId: emergency.id,
              scopes: EMERGENCY_SCOPES,
              reasonCode: "emergency_event",
              explanation: "Time-boxed emergency access is active.",
              correlationId,
            }
          : deny(
              ctx,
              "emergency_scope_exceeded",
              "Emergency access covers only the minimal emergency data set.",
            );
        await record(d, ctx, patientId, action, wanted);
        return d;
      }

      const d = deny(
        ctx,
        "no_active_grant",
        "The patient has not granted access for this data.",
      );
      await record(d, ctx, patientId, action, wanted);
      return d;
    }

    const d = deny(ctx, "unknown_role", "Access could not be evaluated.");
    await record(d, ctx, patientId, action, wanted);
    return d;
  },

  /** Evaluate + assert: throws PolicyDeniedError on deny/step-up. */
  async authorize(
    ctx: AccessContext,
    patientId: string,
    wanted: ConsentScope[] | "*",
    action: string,
  ): Promise<PolicyDecision> {
    const d = await this.evaluate(ctx, patientId, wanted, action);
    if (d.decision !== "allow") throw new PolicyDeniedError(d);
    return d;
  },
};

function matchScopes(
  ctx: AccessContext,
  scopes: ConsentScope[],
  basisId: string | null,
  basisType: AccessBasisType,
  wanted: ConsentScope[] | "*",
  correlationId: string,
): PolicyDecision {
  const ok = wanted === "*" ? scopes.length > 0 : wanted.every((s) => scopes.includes(s));
  return ok
    ? {
        decision: "allow",
        basisType,
        basisId,
        scopes,
        reasonCode: "consent_grant",
        explanation: "Access granted by the patient.",
        correlationId,
      }
    : deny(ctx, "scope_not_granted", "The patient's grant does not cover this data category.");
}

async function record(
  d: PolicyDecision,
  ctx: AccessContext,
  patientId: string,
  action: string,
  wanted: ConsentScope[] | "*",
) {
  try {
    await db.insert(accessPolicyEvaluations).values({
      actorId: ctx.actorId,
      patientId,
      action,
      scope: wanted === "*" ? "*" : wanted.join(","),
      decision: d.decision,
      accessBasisType: d.basisType,
      accessBasisId: d.basisId,
      allowedScopes: d.scopes,
      reasonCode: d.reasonCode,
      explanation: d.explanation,
      correlationId: d.correlationId,
      policyVersion: POLICY_VERSION,
    });
  } catch (err) {
    // Decision logging is best-effort; the decision itself is authoritative.
    console.error("[policy] evaluation log failed", err);
  }
}
