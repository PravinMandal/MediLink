"use server";

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { portalHomeForRole } from "@/server/session";
import type { User } from "@/server/db/schema";

export type FormState = { error?: string; ok?: string };

/**
 * Self-signup may only choose between patient and doctor-in-training.
 * lab_staff / org_admin / platform_admin are granted exclusively by a
 * platform admin — never through the public signup form or the auth API.
 */
const SIGNUP_ROLES = new Set(["patient", "doctor"]);
const SAFE_NEXT = /^\/[^/](.*)?$/; // "/" + non-slash start: blocks "//evil.com"

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  try {
    const res = (await auth.api.signInEmail({
      body: { email, password },
    } as never)) as { user?: { id?: string; email?: string } };
    // The auth response's user object may omit custom columns (role) — read
    // the authoritative role from the user row (same principle as getSessionUser).
    let role: User["role"] = "patient";
    const { db } = await import("@/server/db");
    const { user: userTable } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    const key = res.user?.id ?? res.user?.email ?? email;
    const [row] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(
        res.user?.id
          ? eq(userTable.id, res.user.id)
          : eq(userTable.email, key),
      );
    if (row?.role) role = row.role;
    if (next && SAFE_NEXT.test(next)) redirect(next);
    redirect(portalHomeForRole(role));
  } catch (err) {
    // redirect() throws; only real errors surface here
    const message = err instanceof Error ? err.message : String(err);
    if (message?.includes("NEXT_REDIRECT")) throw err;
    return { error: "Email or password is incorrect." };
  }
}

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "patient");

  if (!name || !email) return { error: "Enter your name and email." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (!SIGNUP_ROLES.has(role)) return { error: "Choose a valid role." };

  try {
    // role has input:false in auth config — the account is created as a
    // patient, then doctor signup promotes its own row explicitly.
    const res = (await auth.api.signUpEmail({
      body: { name, email, password },
    } as never)) as { user?: { id?: string } };
    if (role === "doctor" && res.user?.id) {
      const { db } = await import("@/server/db");
      const { user: userTable } = await import("@/server/db/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(userTable)
        .set({ role: "doctor" })
        .where(eq(userTable.id, res.user.id));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message?.includes("NEXT_REDIRECT")) throw err;
    if (/already|exist/i.test(message)) {
      return { error: "An account with this email already exists. Sign in instead." };
    }
    // Better Auth rejects weak/breached passwords with distinct messages —
    // surface them as actionable password feedback instead of a generic error.
    if (/password/i.test(message) && /weak|common|breached|too/i.test(message)) {
      return { error: "Choose a stronger password — common or breached passwords are rejected." };
    }
    return { error: "Could not create the account. Try again." };
  }

  // Sign in immediately after signup
  try {
    await auth.api.signInEmail({ body: { email, password } } as never);
  } catch {
    // Account WAS created — tell the user instead of a bare sign-in page.
    redirect("/sign-in?registered=1");
  }
  // Doctors land on verification — their obvious next step — not the empty
  // patient-search home.
  if (role === "doctor") redirect("/portal/doctor/verification");
  redirect(portalHomeForRole(role as User["role"]));
}

export async function signOutAction() {
  const { headers } = await import("next/headers");
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
