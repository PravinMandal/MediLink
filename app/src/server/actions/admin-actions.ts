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
