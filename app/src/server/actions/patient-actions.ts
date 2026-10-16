"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { field, optField, FIELD_LIMITS } from "@/server/modules/security/field";
import { consent, type ConsentScope } from "@/server/modules/consent/service";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { audit } from "@/server/modules/audit/service";
import { notify } from "@/server/modules/notifications/service";
import { disputes } from "@/server/modules/records/versions";
import type { FormState } from "./auth-actions";

export async function updatePatientProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return { error: "No patient record linked to this account." };

  try {
    const phoneR = optField(formData.get("phone"), FIELD_LIMITS.short, { label: "Phone" });
    if (!phoneR.ok) return { error: phoneR.error };
    const cityR = optField(formData.get("city"), FIELD_LIMITS.short, { label: "City" });
    if (!cityR.ok) return { error: cityR.error };
    const ecNameR = optField(formData.get("ecName"), FIELD_LIMITS.short, { label: "Emergency contact name" });
    if (!ecNameR.ok) return { error: ecNameR.error };
    const ecPhoneR = optField(formData.get("ecPhone"), FIELD_LIMITS.short, { label: "Emergency contact phone" });
    if (!ecPhoneR.ok) return { error: ecPhoneR.error };
    const bloodGroupR = optField(formData.get("bloodGroup"), FIELD_LIMITS.short, { label: "Blood group" });
    if (!bloodGroupR.ok) return { error: bloodGroupR.error };
    const abhaR = optField(formData.get("abha"), FIELD_LIMITS.short, { label: "ABHA number" });
    if (!abhaR.ok) return { error: abhaR.error };
    await patientService.updateSelf(user.id, patient.id, {
      phone: phoneR.value,
      addressCity: cityR.value,
      emergencyContactName: ecNameR.value,
      emergencyContactPhone: ecPhoneR.value,
      bloodGroupSelfReported: bloodGroupR.value,
      // 14-digit ABHA; digits/hyphens normalized, otherwise cleared.
      abhaNumber: abhaR.value?.replace(/[\s-]/g, "") || undefined,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    if (err instanceof Error && err.message === "INVALID_ABHA")
      return { error: "ABHA must be exactly 14 digits (or left blank)." };
    if (err instanceof Error && err.message === "INVALID_BLOOD_GROUP")
      return { error: "Choose a valid blood group from the list." };
    if (err instanceof Error && err.message === "FIELD_TOO_LONG")
      return { error: "One of the fields is too long. Keep each under 120 characters." };
    return { error: "Could not update the profile." };
  }

  revalidatePath("/portal/patient/profile");
  revalidatePath("/portal/patient/emergency");
  return { ok: "Profile updated. Self-reported values never override verified lab data." };
}

export async function grantConsentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return { error: "No patient record linked to this account." };

  const granteeR = field(formData.get("granteeId"), FIELD_LIMITS.short, { label: "Grantee", required: true });
  if (!granteeR.ok) return { error: granteeR.error };
  const granteeId = granteeR.value;
  // M2: NaN or non-numeric input must fall back to the default, not clamp
  // into NaN (Math.min(NaN,...) → NaN → 1-day grant via later NaN quirks).
  const rawDays = Number(formData.get("days") ?? 7);
  const days = Math.min(
    Math.max(Number.isFinite(rawDays) ? Math.floor(rawDays) : 7, 1),
    365,
  );
  const purposeR = field(formData.get("purpose") ?? "treatment", FIELD_LIMITS.short, { label: "Purpose", required: true });
  if (!purposeR.ok) return { error: purposeR.error };
  const PURPOSES = ["treatment", "consultation", "emergency", "record_review"] as const;
  if (!(PURPOSES as readonly string[]).includes(purposeR.value))
    return { error: "Choose a valid purpose." };
  const purpose = purposeR.value as (typeof PURPOSES)[number];
  const rawScopes = formData.getAll("scopes").map(String);
  if (rawScopes.some((s) => s.length > FIELD_LIMITS.short))
    return { error: "One of the selected scopes is too long." };
  const scopes = rawScopes
    .filter((s): s is ConsentScope =>
      [
        "demographics",
        "conditions",
        "allergies",
        "medications",
        "lab_results",
        "imaging",
        "procedures",
        "documents",
      ].includes(s),
    );

  if (!granteeId || !scopes.length) {
    return { error: "Choose a doctor or facility and at least one data category." };
  }

  try {
    const [granteeType, id] = granteeId.split(":");
    let granteeUserId: string | null = null;
    let granteeName = "";
    if (granteeType === "practitioner") {
      const { practitioners } = await import("@/server/db/schema");
      const [p] = await db
        .select({ userId: practitioners.userId, fullName: practitioners.fullName })
        .from(practitioners)
        .where(eq(practitioners.id, id));
      if (!p) return { error: "Practitioner not found." };
      granteeUserId = p.userId;
      granteeName = p.fullName;
    } else if (granteeType === "organization") {
      const { organizations } = await import("@/server/db/schema");
      const [o] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, id));
      if (!o) return { error: "Organization not found." };
      granteeName = o.name;
    } else {
      return { error: "Invalid grantee." };
    }

    await consent.grant({
      patientId: patient.id,
      patientUserId: user.id,
      granteeType: granteeType as "practitioner" | "organization",
      granteePractitionerId: granteeType === "practitioner" ? id : undefined,
      granteeOrganizationId: granteeType === "organization" ? id : undefined,
      scopes,
      purpose,
      days,
      granteeName,
      granteeUserId,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not grant access." };
  }

  revalidatePath("/portal/patient/consents");
  return { ok: `Access granted for ${days} day${days > 1 ? "s" : ""}.` };
}

export async function revokeConsentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const consentR = field(formData.get("consentId"), FIELD_LIMITS.short, { label: "Consent", required: true });
  if (!consentR.ok) return { error: consentR.error };
  const consentId = consentR.value;
  const patient = await patientService.forUser(user.id);
  if (!patient) return { error: "No patient record linked to this account." };

  try {
    await consent.revoke(user.id, consentId);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not revoke." };
  }

  revalidatePath("/portal/patient/consents");
  return { ok: "Access revoked. It takes effect immediately." };
}

/** Doctor requests access → patient gets a notification (no auto-grant). */
export async function requestAccessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patientR = field(formData.get("patientId"), FIELD_LIMITS.short, { label: "Patient", required: true });
  if (!patientR.ok) return { error: patientR.error };
  const patientId = patientR.value;
  try {
    const practitioner = await getPractitionerForUser(user.id);
    if (!practitioner) return { error: "Practitioner profile missing." };

    const { patients: patientsTable } = await import("@/server/db/schema");
    const [patient] = await db
      .select({ userId: patientsTable.userId, fullName: patientsTable.fullName })
      .from(patientsTable)
      .where(eq(patientsTable.id, patientId));
    if (!patient?.userId) return { error: "This patient has no linked account to notify." };

    await notify.push({
      userId: patient.userId,
      type: "consent.requested",
      title: `${practitioner.fullName} requested access to your records`,
      body: `Purpose: consultation. Grant access from your Consents page.`,
      link: "/portal/patient/consents",
    });
    await audit.record({
      actorId: user.id,
      actorRole: "doctor",
      patientId,
      action: "consent.requested",
      resourceType: "patient",
      resourceId: patientId,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not send the request." };
  }
  return { ok: "Request sent. The patient will see it in their notifications." };
}

/** Patient flags a clinical record as wrong (BuildPlan §7.10, Backlog D).
 *  Only the owning patient account can raise a dispute on their own chart,
 *  and a dispute never rewrites a provider's attestation. */
export async function raiseDisputeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "patient")
    return { error: "Only the patient account can flag concerns from this page." };
  const patient = await patientService.forUser(user.id);
  if (!patient) return { error: "No patient record linked to this account." };

  const resourceR = field(formData.get("resourceId"), FIELD_LIMITS.short, { label: "Record", required: true });
  if (!resourceR.ok) return { error: resourceR.error };
  const resourceId = resourceR.value;
  const resourceTypeR = field(formData.get("resourceType"), FIELD_LIMITS.short, { label: "Record type", required: true });
  if (!resourceTypeR.ok) return { error: resourceTypeR.error };
  const resourceType = resourceTypeR.value;
  // Fail closed: only known clinical tables (the set scopeForResource maps
  // in access/guard.ts) may be flagged — never an arbitrary resource type.
  try {
    const { scopeForResource } = await import("@/server/modules/access/guard");
    scopeForResource(resourceType);
  } catch {
    return { error: "Unknown record type." };
  }
  const reasonR = field(formData.get("reason"), FIELD_LIMITS.long, { label: "Reason", required: true });
  if (!reasonR.ok) return { error: reasonR.error };
  const reason = reasonR.value;
  if (reason.length < 5)
    return { error: "Describe what is wrong (at least 5 characters)." };

  try {
    await disputes.raise({
      patientId: patient.id,
      raisedBy: user.id,
      resourceId,
      resourceType,
      reason,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not flag this record. Try again." };
  }

  revalidatePath("/portal/patient/record");
  return { ok: "Concern recorded. This record is now marked disputed and under review." };
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await notify.markAllRead(user.id);
  revalidatePath("/portal", "layout");
  return;
}

/** Patient rotates the emergency-card QR (lost or reprinted card). */
export async function rotateEmergencyCardAction(): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "patient") return { error: "Patient accounts only." };
  const patient = await patientService.forUser(user.id);
  if (!patient) return { error: "No patient record linked to this account." };
  try {
    const { emergencyCard } = await import(
      "@/server/modules/identity/emergency-card"
    );
    await emergencyCard.rotate(user.id, patient.id);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not replace the emergency code. Try again." };
  }
  revalidatePath("/portal/patient/emergency");
  return {
    ok: "New emergency code on the card. Any previously printed card no longer resolves.",
  };
}

/** Update account name/phone. */
export async function updateAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const nameR = field(formData.get("name"), FIELD_LIMITS.short, { label: "Name", required: true });
  if (!nameR.ok) return { error: nameR.error };
  const phoneR = optField(formData.get("phone"), FIELD_LIMITS.short, { label: "Phone" });
  if (!phoneR.ok) return { error: phoneR.error };
  const name = nameR.value;
  const phone = phoneR.value ?? "";
  try {
    await db
      .update(userTable)
      .set({ name, phone: phone || null, updatedAt: new Date() })
      .where(eq(userTable.id, user.id));
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not update the account. Try again." };
  }
  revalidatePath("/portal", "layout");
  return { ok: "Account updated." };
}
