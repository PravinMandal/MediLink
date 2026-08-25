/**
 * Access guard — THE single enforcement point for every clinical read.
 *
 * Rules:
 * - Patients see their own record (any scope).
 * - Doctors/staff see only what an active, unexpired consent grant covers.
 * - Break-glass emergency access unlocks a critical subset, time-boxed,
 *   always audited.
 * - Platform admins are denied clinical reads here on purpose.
 *
 * Since BuildPlan §10.2 (single policy decision point), `check` delegates to
 * the centralized policy service: identity-caution states block professional
 * access, and every decision is recorded in `access_policy_evaluations`.
 * This module remains the call-site API the security tests attack; the
 * decision logic itself lives in access/policy.ts.
 */
import type { ConsentScope } from "@/server/modules/consent/service";
import {
  EMERGENCY_SCOPES,
  policy,
  type PolicyDecision,
} from "@/server/modules/access/policy";

export { EMERGENCY_SCOPES };

export type AccessVia = "self" | "consent" | "emergency";

export type AccessDecision = {
  allowed: boolean;
  via: AccessVia | null;
  scopes: ConsentScope[];
};

export class AccessDeniedError extends Error {
  constructor(message = "ACCESS_DENIED") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

/** Imaging modalities: diagnostic reports about these map to "imaging". */
const IMAGING_CATEGORY = new Set(["imaging", "radiology", "radiology_report"]);
const IMAGING_MODALITIES =
  /(x-?ray|radiograph|ct|cat scan|mri|ultrasound|sonograph|echo|echocardiograph|pet|scan|mammograph)/i;

/** Map a clinical table name to the consent scope governing it. */
export function scopeForResource(
  resourceType: string,
  kind?: string | null,
): ConsentScope {
  switch (resourceType) {
    case "conditions":
    case "condition":
    case "encounters":
    case "encounter":
      return "conditions";
    case "allergies":
    case "allergy":
      return "allergies";
    case "medication_statements":
    case "medication_statement":
      return "medications";
    case "observations":
    case "observation":
      return "lab_results";
    case "diagnostic_reports":
    case "diagnostic_report": {
      // H1: imaging reports are governed by the "imaging" scope, not
      // lab_results. Distinguish by the report's category/kind column.
      const k = kind?.trim() ?? "";
      if (IMAGING_CATEGORY.has(k.toLowerCase()) || IMAGING_MODALITIES.test(k))
        return "imaging";
      return "lab_results";
    }
    case "procedures":
    case "procedure":
    case "immunizations":
    case "immunization":
      return "procedures";
    case "documents":
    case "document":
      return "documents";
    default:
      // Fail closed: an unmapped resource type must never silently fall
      // back to a granted scope.
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
}

interface GuardUser {
  id: string;
  role: "patient" | "doctor" | "lab_staff" | "org_admin" | "platform_admin";
  organizationId?: string | null;
}

function toDecision(d: PolicyDecision): AccessDecision {
  return {
    allowed: d.decision === "allow",
    via: d.basisType === "none" ? null : d.basisType,
    scopes: d.scopes,
  };
}

export const access = {
  /**
   * Single policy decision point (§10.2): evaluation, identity-caution
   * enforcement, and decision recording all live in access/policy.ts.
   */
  async check(
    user: GuardUser,
    patientId: string,
    scope: ConsentScope | ConsentScope[] | "*",
  ): Promise<AccessDecision> {
    const wanted =
      scope === "*" ? "*" : Array.isArray(scope) ? scope : [scope];
    const decision = await policy.evaluate(
      {
        actorId: user.id,
        role: user.role,
        organizationId: user.organizationId ?? null,
      },
      patientId,
      wanted,
      "clinical_read",
    );
    return toDecision(decision);
  },

  async assert(
    user: GuardUser,
    patientId: string,
    scope: ConsentScope | ConsentScope[] | "*",
  ): Promise<AccessDecision> {
    const decision = await this.check(user, patientId, scope);
    if (!decision.allowed) throw new AccessDeniedError();
    return decision;
  },
};
