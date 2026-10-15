"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import {
  reviewOrganizationVerification,
  reviewPractitionerVerification,
} from "@/server/modules/identity/verification";
import { emergency } from "@/server/modules/emergency/service";
import { audit } from "@/server/modules/audit/service";
import { field, optField, FIELD_LIMITS } from "@/server/modules/security/field";
import type { FormState } from "./auth-actions";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "platform_admin") throw new Error("ACCESS_DENIED");
  return user;
}

export async function reviewPractitionerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const practitionerR = field(formData.get("practitionerId"), FIELD_LIMITS.short, { label: "Practitioner", required: true });
    if (!practitionerR.ok) return { error: practitionerR.error };
    const notesR = optField(formData.get("notes"), FIELD_LIMITS.long, { label: "Notes" });
    if (!notesR.ok) return { error: notesR.error };
    await reviewPractitionerVerification({
      reviewerId: admin.id,
      practitionerId: practitionerR.value,
      approve: String(formData.get("approve") ?? "") === "1",
      notes: notesR.value,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Review failed." };
  }
  revalidatePath("/portal/admin");
  return { ok: "Verification reviewed." };
}

export async function reviewOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const orgR = field(formData.get("organizationId"), FIELD_LIMITS.short, { label: "Organization", required: true });
    if (!orgR.ok) return { error: orgR.error };
    const notesR = optField(formData.get("notes"), FIELD_LIMITS.long, { label: "Notes" });
    if (!notesR.ok) return { error: notesR.error };
    await reviewOrganizationVerification({
      reviewerId: admin.id,
      organizationId: orgR.value,
      approve: String(formData.get("approve") ?? "") === "1",
      notes: notesR.value,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Review failed." };
  }
  revalidatePath("/portal/admin");
  return { ok: "Organization reviewed." };
}

export async function reviewEmergencyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const eventR = field(formData.get("eventId"), FIELD_LIMITS.short, { label: "Event", required: true });
    if (!eventR.ok) return { error: eventR.error };
    const statusR = field(formData.get("status") ?? "reviewed", FIELD_LIMITS.short, { label: "Status" });
    if (!statusR.ok) return { error: statusR.error };
    const notesR = optField(formData.get("notes"), FIELD_LIMITS.long, { label: "Notes" });
    if (!notesR.ok) return { error: notesR.error };
    await emergency.review({
      reviewerId: admin.id,
      eventId: eventR.value,
      status: statusR.value as "reviewed" | "flagged",
      notes: notesR.value,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Review failed." };
  }
  revalidatePath("/portal/admin");
  return { ok: "Break-glass event reviewed." };
}

export async function verifyAuditChainAction(): Promise<FormState & { brokenAt?: number | null }> {
  try {
    await requireAdmin();
    const brokenAt = await audit.verifyChain();
    revalidatePath("/portal/admin");
    return { ok: brokenAt === null ? "Audit chain intact ✓" : `CHAIN BROKEN at #${brokenAt}`, brokenAt };
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    return { error: "Could not verify the chain." };
  }
}

/**
 * D2 remainder: professional roles are granted only by a platform admin.
 * platform_admin itself can never be granted through this flow.
 *
 * The grant core lives in server/modules/admin/roles.ts (no "use server"
 * there). This action derives the actor from the session — never from a
 * caller-supplied id.
 */

export async function setUserRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const targetR = field(formData.get("userId"), FIELD_LIMITS.short, { label: "User", required: true });
    if (!targetR.ok) return { error: targetR.error };
    const roleR = field(formData.get("role"), FIELD_LIMITS.short, { label: "Role", required: true });
    if (!roleR.ok) return { error: roleR.error };
    const reasonR = field(formData.get("reason"), FIELD_LIMITS.long, { label: "Reason", required: true });
    if (!reasonR.ok) return { error: reasonR.error };
    const targetUserId = targetR.value;
    const role = roleR.value;
    const reason = reasonR.value;

    const { grantUserRole } = await import("@/server/modules/admin/roles");
    await grantUserRole({
      actorId: admin.id,
      targetUserId,
      role,
      reason,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    if (err instanceof Error && err.message === "ACCESS_DENIED") {
      return { error: "Only platform admins can grant roles." };
    }
    if (err instanceof Error && err.message === "INVALID_ROLE") {
      return { error: "That role cannot be granted." };
    }
    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      return { error: "User not found." };
    }
    return { error: "Role grant failed." };
  }
  revalidatePath("/portal/admin");
  return { ok: "Role granted." };
}
