"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

function isRedirect(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message?.includes("NEXT_REDIRECT");
}

async function roleForUser(userId?: string, email?: string): Promise<User["role"]> {
  try {
    const { db } = await import("@/server/db");
    const { user: userTable } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    if (!userId && !email) return "patient";
    const [row] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(userId ? eq(userTable.id, userId) : eq(userTable.email, email!))
      .limit(1);
    return row?.role ?? "patient";
  } catch {
    return "patient";
  }
}

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
      headers: await headers(),
    } as never)) as { user?: { id?: string; email?: string } };
    const role = await roleForUser(res.user?.id, res.user?.email ?? email);
    if (next && SAFE_NEXT.test(next)) redirect(next);
    redirect(portalHomeForRole(role));
  } catch (err) {
    if (isRedirect(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    // Better Auth surfaces unverified mail distinctly when enforcement is on.
    // Re-send the link here (self-service recovery for pre-Resend accounts)
    // and say exactly that — never imply the password was wrong.
    if (/verif/i.test(message)) {
      try {
        await auth.api.sendVerificationEmail({
          body: { email, callbackURL: "/portal" },
        } as never);
      } catch {
        // Best-effort: the guidance below still holds.
      }
      return {
        error:
          "Please verify your email first — we just re-sent the link. Check your inbox (and spam).",
      };
    }
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

  let userId: string | undefined;
  try {
    // role has input:false in auth config — the account is created as a
    // patient, then doctor signup promotes its own row explicitly.
    const res = (await auth.api.signUpEmail({
      body: { name, email, password },
    } as never)) as { user?: { id?: string } };
    userId = res.user?.id;
    if (role === "doctor" && userId) {
      const { db } = await import("@/server/db");
      const { user: userTable } = await import("@/server/db/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(userTable)
        .set({ role: "doctor" })
        .where(eq(userTable.id, userId));
    }
  } catch (err) {
    if (isRedirect(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (/already|exist/i.test(message)) {
      return { error: "An account with this email already exists. Sign in instead." };
    }
    if (/password/i.test(message) && /weak|common|breached|too/i.test(message)) {
      return { error: "Choose a stronger password — common or breached passwords are rejected." };
    }
    return { error: "Could not create the account. Try again." };
  }

  // Industry standard: if mail is configured, the account exists but the
  // session waits on verification — send them to check their inbox.
  if (process.env.RESEND_API_KEY?.trim()) {
    redirect(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  // No mail provider (local/demo): sign in immediately.
  try {
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    } as never);
  } catch {
    redirect("/sign-in?registered=1");
  }
  if (role === "doctor") redirect("/portal/doctor/verification");
  redirect(portalHomeForRole(role as User["role"]));
}

export async function resendVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email." };
  try {
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL: "/portal" },
    } as never);
    return { ok: "Verification link sent — check your inbox (and spam)." };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: "Could not send the link. Try again in a minute." };
  }
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email." };
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/reset-password" },
    } as never);
    // Always succeed publicly — never reveal whether the address exists.
    return { ok: "If an account exists, a reset link is on its way." };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { ok: "If an account exists, a reset link is on its way." };
  }
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!token) return { error: "This reset link is missing its token." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  try {
    await auth.api.resetPassword({ body: { newPassword: password, token } } as never);
    redirect("/sign-in?reset=1");
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: "This link expired or was already used. Request a new one." };
  }
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
