"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import { discovery } from "@/server/modules/identity/discovery";
import { rateLimit, LIMITS } from "@/server/modules/security/rate-limit";
import { accessRequestsService } from "@/server/modules/consent/access-requests";
import {
  getPractitionerForUser,
  requireVerifiedPractitioner,
} from "@/server/modules/identity/verification";
import type { FormState } from "./auth-actions";
import { db } from "@/server/db";
import { organizations, practitioners } from "@/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Controlled discovery + access-request actions (BuildPlan §7.9, §8.2, §8.3).
 * The name/phone directory is intentionally GONE from doctor discovery.
 */

export type LookupResult =
  | { status: "invalid"; message: string }
  | { status: "rate_limited"; message: string }
  | { status: "no_record"; message: string }
  | { status: "request_access"; patientId: string; message: string }
  | { status: "authorized"; patientId: string; redirect: string };

/** Lookup by Patient ID / verified ABHA — never by name or phone. */
export async function lookupPatientAction(identifier: string): Promise<LookupResult> {
  const user = await requireUser();
  if (user.role !== "doctor") {
    return { status: "invalid", message: "Only clinician accounts look up patients." };
  }
  const result = await discovery.lookupIdentifier({
    actorId: user.id,
    identifier,
  });
  switch (result.kind) {
    case "invalid":
      return { status: "invalid", message: result.message };
    case "rate_limited":
      return { status: "rate_limited", message: result.message };
    case "no_record":
      return { status: "no_record", message: result.message };
    case "record_may_exist": {
      // Is there already an active authorization? Open the workspace; else
      // offer the request flow. Either way, nothing is disclosed here.
      const { consent } = await import("@/server/modules/consent/service");
      const practitioner = await getPractitionerForUser(user.id);
      const grants = practitioner
        ? await consent.activeForPractitioner(result.patientId, practitioner.id)
        : [];
      if (grants.length) {
        return {
          status: "authorized",
          patientId: result.patientId,
          redirect: `/portal/doctor/patients/${result.patientId}`,
        };
      }
      return {
        status: "request_access",
        patientId: result.patientId,
        message: "A MediLink record may exist for this identifier. Request access to proceed.",
      };
    }
    default:
      return { status: "invalid", message: "Lookup failed." };
  }
}

/** Clinician redeems a patient-present handoff code. */
export async function redeemHandoffAction(
  code: string,
): Promise<{ ok: true; patientId: string } | { ok: false; message: string }> {
  const user = await requireUser();
  if (user.role !== "doctor") {
    return { ok: false, message: "Only clinician accounts redeem sharing codes." };
  }
  return discovery.redeemHandoff({ clinicianUserId: user.id, code });
}

/** Doctor creates + submits an access request (BuildPlan §8.3). */
export async function createAccessRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "doctor") return { error: "Only clinician accounts request access." };
  const patientId = String(formData.get("patientId") ?? "");
  const purpose = String(formData.get("purpose") ?? "treatment");
  const purposeDetail = String(formData.get("purposeDetail") ?? "").trim() || undefined;
  const visitReference = String(formData.get("visitReference") ?? "").trim() || undefined;
  const days = Number(formData.get("days") ?? 7);
  const suggested = formData.getAll("suggestedScopes").map(String);

  if (!patientId) return { error: "Missing patient." };
  if (!Number.isFinite(days) || days < 1 || days > 90) {
    return { error: "Duration must be 1-90 days." };
  }
  // Abuse control (Backlog C): bound request creation per requester.
  if (!rateLimit(`access_request:${user.id}`, LIMITS.accessRequest)) {
    return { error: "Too many requests sent. Wait a minute and try again." };
  }

  try {
    const practitioner = await requireVerifiedPractitioner(user.id);
    const [p] = await db
      .select({
        fullName: practitioners.fullName,
        specialty: practitioners.specialty,
        verificationStatus: practitioners.verificationStatus,
        organizationId: practitioners.organizationId,
      })
      .from(practitioners)
      .where(eq(practitioners.id, practitioner.id));
    let orgName: string | null = null;
    if (p?.organizationId) {
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, p.organizationId));
      orgName = org?.name ?? null;
    }
    const draft = await accessRequestsService.createDraft({
      patientId,
      requesterUserId: user.id,
      requesterPractitionerId: practitioner.id,
      requesterOrganizationId: p?.organizationId ?? null,
      requesterSnapshot: {
        name: p?.fullName ?? user.name,
        credentialStatus: p?.verificationStatus ?? "unverified",
        organization: orgName,
        specialty: p?.specialty ?? null,
      },
      purpose,
      purposeDetail,
      visitReference,
      suggestedScopes: suggested,
      requestedDays: days,
    });
    await accessRequestsService.submit(user.id, draft.id);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    if (err instanceof Error && err.message === "VERIFICATION_REQUIRED") {
      return { error: "Your practitioner verification is still pending." };
    }
    return { error: "Could not submit the request." };
  }
  revalidatePath("/portal/doctor");
  return { ok: "Request sent. The patient will see who you are and exactly what you asked for." };
}

/** Patient decision on a pending request (approve with own scope selection / decline). */
export async function decideAccessRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "patient") return { error: "Only the patient decides access requests." };
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const approvedScopes = formData.getAll("scopes").map(String);
  const days = Number(formData.get("days") ?? 0) || undefined;
  const reason = String(formData.get("reason") ?? "").trim() || undefined;

  if (!requestId || !["approve", "decline"].includes(decision)) {
    return { error: "Invalid decision." };
  }

  const { patients } = await import("@/server/db/schema");
  const [p] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, user.id));
  if (!p) return { error: "No patient record linked to your account." };

  try {
    if (decision === "decline") {
      await accessRequestsService.decide({
        patientUserId: user.id,
        patientId: p.id,
        requestId,
        decision: "decline",
        reason,
      });
    } else {
      const result = await accessRequestsService.decide({
        patientUserId: user.id,
        patientId: p.id,
        requestId,
        decision: "approve",
        approvedScopes: approvedScopes as never,
        days,
        reason,
      });
      void result;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    const message = err instanceof Error ? err.message : "";
    if (message === "ACCESS_DENIED") return { error: "This request is not for your record." };
    if (message.includes("Select at least one")) return { error: message };
    return { error: "Could not record your decision." };
  }

  revalidatePath("/portal/patient/consents");
  return {
    ok:
      decision === "approve"
        ? "Access granted. You can revoke it at any time from Access."
        : "Declined. They cannot open your MediLink record.",
  };
}

/** Patient cancels/declines by reporting a concern (routes to trust & safety). */
export async function reportConcernAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!requestId) return { error: "Missing request." };
  if (reason.length < 5) return { error: "Describe your concern briefly." };

  const { audit } = await import("@/server/modules/audit/service");
  const { notify } = await import("@/server/modules/notifications/service");
  const [adminRow] = await db
    .select({ id: (await import("@/server/db/schema")).user.id })
    .from((await import("@/server/db/schema")).user)
    .where(eq((await import("@/server/db/schema")).user.role, "platform_admin"))
    .limit(1);
  await audit.record({
    actorId: user.id,
    actorRole: user.role,
    action: "access_request.concern_reported",
    resourceType: "access_request",
    resourceId: requestId,
    reason,
  });
  if (adminRow) {
    await notify.push({
      userId: adminRow.id,
      type: "access_request",
      title: "A patient reported an access request concern",
      body: reason.slice(0, 200),
      link: "/portal/admin",
    });
  }
  return { ok: "Reported. Our trust and safety team will review this request." };
}

/** Patient starts a patient-present sharing session (handoff code). */
export async function createHandoffAction(): Promise<
  { ok: true; code: string; expiresAt: string } | { ok: false; message: string }
> {
  const user = await requireUser();
  if (user.role !== "patient") return { ok: false, message: "Patient accounts only." };
  const { patients } = await import("@/server/db/schema");
  const [p] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.userId, user.id));
  if (!p) return { ok: false, message: "No patient record linked to your account." };
  const { code, expiresAt } = await discovery.createHandoff(user.id, p.id);
  return { ok: true, code, expiresAt: expiresAt.toISOString() };
}
