"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { consent, type ConsentScope } from "@/server/modules/consent/service";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { audit } from "@/server/modules/audit/service";
import { notify } from "@/server/modules/notifications/service";
import type { FormState } from "./auth-actions";

export async function updatePatientProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return { error: "No patient record linked to this account." };

  try {
    await patientService.updateSelf(user.id, patient.id, {
      phone: String(formData.get("phone") ?? "") || undefined,
      addressCity: String(formData.get("city") ?? "") || undefined,
      emergencyContactName: String(formData.get("ecName") ?? "") || undefined,
      emergencyContactPhone: String(formData.get("ecPhone") ?? "") || undefined,
      bloodGroupSelfReported:
        String(formData.get("bloodGroup") ?? "") || undefined,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
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

  const granteeId = String(formData.get("granteeId") ?? "");
  const days = Math.min(Math.max(Number(formData.get("days") ?? 7), 1), 365);
  const purpose = String(formData.get("purpose") ?? "treatment") as
    | "treatment"
    | "consultation"
    | "emergency"
    | "record_review";
  const scopes = formData
    .getAll("scopes")
    .map(String)
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
        "sensitive",
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
  const consentId = String(formData.get("consentId") ?? "");
  if (!consentId) return { error: "Missing consent." };
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
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) return { error: "Missing patient." };
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

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await notify.markAllRead(user.id);
  revalidatePath("/portal", "layout");
}

/** Update account name/phone. */
export async function updateAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "Name is required." };
  await db
    .update(userTable)
    .set({ name, phone: phone || null, updatedAt: new Date() })
    .where(eq(userTable.id, user.id));
  revalidatePath("/portal", "layout");
  return { ok: "Account updated." };
}
