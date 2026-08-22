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
 * Every service in records/documents/search/ai funnels through
 * `assertCanAccess` — this is the module the security tests attack.
 */
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/server/db";
import {
  emergencyAccessEvents,
  patients,
} from "@/server/db/schema";
import {
  consent as consentService,
  ALL_SCOPES,
  type ConsentScope,
} from "@/server/modules/consent/service";
import { getPractitionerForUser } from "@/server/modules/identity/verification";

/** Scopes unlockable via break-glass emergency access. */
export const EMERGENCY_SCOPES: ConsentScope[] = [
  "demographics",
  "conditions",
  "allergies",
  "medications",
  "lab_results",
];

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

export const access = {
  async check(
    user: GuardUser,
    patientId: string,
    scope: ConsentScope | ConsentScope[] | "*",
  ): Promise<AccessDecision> {
    // Patient self-access
    if (user.role === "patient") {
      const [row] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.userId, user.id)));
      return row
        ? { allowed: true, via: "self", scopes: [...ALL_SCOPES] }
        : { allowed: false, via: null, scopes: [] };
    }

    // Platform admins never read clinical data through this path.
    if (user.role === "platform_admin") {
      return { allowed: false, via: null, scopes: [] };
    }

    // Organization-scoped staff (labs, org admins)
    if (user.role === "lab_staff" || user.role === "org_admin") {
      if (!user.organizationId) return { allowed: false, via: null, scopes: [] };
      const grants = await consentService.activeForOrganization(
        patientId,
        user.organizationId,
      );
      const scopes = grants.flatMap((g) => g.scopes as ConsentScope[]);
      if (scope === "*") {
        return scopes.length
          ? { allowed: true, via: "consent", scopes }
          : { allowed: false, via: null, scopes: [] };
      }
      const wanted = Array.isArray(scope) ? scope : [scope];
      const ok = wanted.every((s) => scopes.includes(s));
      return ok
        ? { allowed: true, via: "consent", scopes }
        : { allowed: false, via: null, scopes: [] };
    }

    // Doctors: consent grants to their practitioner identity…
    if (user.role === "doctor") {
      const practitioner = await getPractitionerForUser(user.id);
      if (!practitioner) return { allowed: false, via: null, scopes: [] };

      const grants = await consentService.activeForPractitioner(
        patientId,
        practitioner.id,
      );
      const scopes = grants.flatMap((g) => g.scopes as ConsentScope[]);

      if (scope !== "*") {
        const wanted = Array.isArray(scope) ? scope : [scope];
        if (wanted.every((s) => scopes.includes(s))) {
          return { allowed: true, via: "consent", scopes };
        }
      } else if (scopes.length) {
        return { allowed: true, via: "consent", scopes };
      }

      // …or an active break-glass emergency session.
      const [emergency] = await db
        .select()
        .from(emergencyAccessEvents)
        .where(
          and(
            eq(emergencyAccessEvents.patientId, patientId),
            eq(emergencyAccessEvents.practitionerId, practitioner.id),
            gt(emergencyAccessEvents.expiresAt, new Date()),
            or(
              isNull(emergencyAccessEvents.reviewStatus),
              eq(emergencyAccessEvents.reviewStatus, "pending"),
              eq(emergencyAccessEvents.reviewStatus, "reviewed"),
            ),
          ),
        );
      if (emergency) {
        if (scope === "*") {
          return { allowed: true, via: "emergency", scopes: EMERGENCY_SCOPES };
        }
        const wanted = Array.isArray(scope) ? scope : [scope];
        const ok = wanted.every((s) => EMERGENCY_SCOPES.includes(s));
        return ok
          ? { allowed: true, via: "emergency", scopes: EMERGENCY_SCOPES }
          : { allowed: false, via: null, scopes: [] };
      }
    }

    return { allowed: false, via: null, scopes: [] };
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
