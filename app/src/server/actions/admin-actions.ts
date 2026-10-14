"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/session";
import {
  reviewOrganizationVerification,
  reviewPractitionerVerification,
} from "@/server/modules/identity/verification";
import { emergency } from "@/server/modules/emergency/service";
import { audit } from "@/server/modules/audit/service";
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
    await reviewPractitionerVerification({
      reviewerId: admin.id,
      practitionerId: String(formData.get("practitionerId") ?? ""),
      approve: String(formData.get("approve") ?? "") === "1",
      notes: String(formData.get("notes") ?? "") || undefined,
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
    await reviewOrganizationVerification({
      reviewerId: admin.id,
      organizationId: String(formData.get("organizationId") ?? ""),
      approve: String(formData.get("approve") ?? "") === "1",
      notes: String(formData.get("notes") ?? "") || undefined,
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
    await emergency.review({
      reviewerId: admin.id,
      eventId: String(formData.get("eventId") ?? ""),
      status: String(formData.get("status") ?? "reviewed") as "reviewed" | "flagged",
      notes: String(formData.get("notes") ?? "") || undefined,
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
 */
const GRANTABLE_ROLES = new Set(["doctor", "lab_staff", "org_admin"]);

export async function setUserRoleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const admin = await requireAdmin();
    const targetUserId = String(formData.get("userId") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    if (!targetUserId) return { error: "Choose a user." };
    if (!reason) return { error: "A reason is required for role grants." };

    await setUserRole({
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

export async function setUserRole(input: {
  actorId: string;
  targetUserId: string;
  role: string;
  reason: string;
}): Promise<void> {
  // Re-assert the actor's CURRENT role from the database — the session
  // cookie alone must never authorize (same principle as getSessionUser).
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/server/db");
  const { user: userTable } = await import("@/server/db/schema");
  const [actor] = await db
    .select({ id: userTable.id, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, input.actorId))
    .limit(1);
  if (!actor || actor.role !== "platform_admin") {
    throw new Error("ACCESS_DENIED");
  }
  if (!GRANTABLE_ROLES.has(input.role)) {
    // platform_admin elevation is never allowed through this flow
    throw new Error("INVALID_ROLE");
  }
  // Verify-then-write: the old order mutated before checking existence,
  // so a concurrent deletion threw USER_NOT_FOUND after writing (and a
  // crash between write and audit stranded a privilege grant with no trail).
  const [target] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, input.targetUserId))
    .limit(1);
  if (!target) throw new Error("USER_NOT_FOUND");
  await db
    .update(userTable)
    .set({ role: input.role as "doctor" | "lab_staff" | "org_admin" })
    .where(eq(userTable.id, input.targetUserId));

  await audit.record({
    actorId: input.actorId,
    actorRole: "platform_admin",
    action: "user.role.granted",
    resourceType: "user",
    resourceId: input.targetUserId,
    reason: input.reason,
    metadata: { role: input.role },
  });
}
