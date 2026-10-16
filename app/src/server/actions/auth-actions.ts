"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { portalHomeForRole } from "@/server/session";
import { rateLimit, LIMITS } from "@/server/modules/security/rate-limit";
import { safeNextOr } from "@/server/modules/security/redirect";
import { field, optField, FIELD_LIMITS } from "@/server/modules/security/field";
import type { User } from "@/server/db/schema";

const PASSWORD_MAX = 512;
function passwordTooLong(password: string): string | null {
  if (password.length > PASSWORD_MAX)
    return `Password is too long (max ${PASSWORD_MAX} characters).`;
  return null;
}

export type FormState = { error?: string; ok?: string };

/**
 * Self-signup may only choose between patient and doctor-in-training.
 * lab_staff / org_admin / platform_admin are granted exclusively by a
 * platform admin — never through the public signup form or the auth API.
 */
const SIGNUP_ROLES = new Set(["patient", "doctor"]);
// Safe post-login redirect lives in modules/security/redirect (single
// definition shared with the sign-in page — never a local copy).

function isRedirect(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message?.includes("NEXT_REDIRECT");
}

/**
 * Look up the post-login landing role. Fail CLOSED: on a DB error (or a
 * missing row after a successful sign-in) return null and send the user to
 * the patient portal — the per-page requireRole gates and session re-reads
 * enforce the real role from there. The old catch-all defaulted to
 * "patient", which is the same landing but hid outages; null makes the
 * fallback explicit at the call site.
 */
async function roleForUser(userId?: string, email?: string): Promise<User["role"] | null> {
  try {
    const { db } = await import("@/server/db");
    const { user: userTable } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    if (!userId && !email) return null;
    const [row] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(userId ? eq(userTable.id, userId) : eq(userTable.email, email!))
      .limit(1);
    return row?.role ?? null;
  } catch {
    return null;
  }
}

/** Per-address throttle for credential-guessing endpoints (online resistance). */
function authThrottled(email: string): boolean {
  return rateLimit(`auth:${email.toLowerCase()}`, LIMITS.auth);
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const emailR = field(formData.get("email"), FIELD_LIMITS.short, { label: "Email" });
  if (!emailR.ok) return { error: emailR.error };
  const email = emailR.value.toLowerCase();
  const password = String(formData.get("password") ?? "");
  const pwErr = passwordTooLong(password);
  if (pwErr) return { error: pwErr };
  const nextR = optField(formData.get("next"), FIELD_LIMITS.short, { label: "Redirect" });
  if (!nextR.ok) return { error: nextR.error };
  const next = nextR.value ?? "";

  if (!email || !password) return { error: "Enter your email and password." };
  // Uniform throttle message: throttled vs wrong-password must be
  // indistinguishable, or the throttle becomes an existence oracle.
  if (!authThrottled(email)) return { error: "Email or password is incorrect." };

  try {
    const res = (await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    } as never)) as { user?: { id?: string; email?: string } };
    const role = (await roleForUser(res.user?.id, res.user?.email ?? email)) ?? "patient";
    redirect(safeNextOr(next, portalHomeForRole(role)));
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
  const nameR = field(formData.get("name"), FIELD_LIMITS.short, { label: "Name" });
  if (!nameR.ok) return { error: nameR.error };
  const emailR = field(formData.get("email"), FIELD_LIMITS.short, { label: "Email" });
  if (!emailR.ok) return { error: emailR.error };
  const name = nameR.value;
  const email = emailR.value.toLowerCase();
  const password = String(formData.get("password") ?? "");
  const pwErr = passwordTooLong(password);
  if (pwErr) return { error: pwErr };
  const roleR = field(formData.get("role") ?? "patient", FIELD_LIMITS.short, { label: "Role" });
  if (!roleR.ok) return { error: roleR.error };
  const role = roleR.value;

  if (!name || !email) return { error: "Enter your name and email." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };
  if (!SIGNUP_ROLES.has(role)) return { error: "Choose a valid role." };
  // Same per-address throttle as sign-in: without it, signup doubles as an
  // unauthenticated existence oracle AND an unlimited account-creation pipe.
  if (!authThrottled(email)) {
    return { error: "Too many attempts. Wait a minute and try again." };
  }

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
  const emailR = field(formData.get("email"), FIELD_LIMITS.short, { label: "Email" });
  if (!emailR.ok) return { error: emailR.error };
  const email = emailR.value.toLowerCase();
  if (!email) return { error: "Enter your email." };
  // Always succeed publicly (like forgotPasswordAction): the error path used
  // to distinguish "no such account" from "mail sent" — an enumeration oracle.
  if (!authThrottled(email)) {
    return { ok: "If an account exists, a verification link is on its way." };
  }
  try {
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL: "/portal" },
    } as never);
  } catch (err) {
    if (isRedirect(err)) throw err;
    // Swallowed deliberately — see above.
  }
  return { ok: "If an account exists, a verification link is on its way." };
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const emailR = field(formData.get("email"), FIELD_LIMITS.short, { label: "Email" });
  if (!emailR.ok) return { error: emailR.error };
  const email = emailR.value.toLowerCase();
  if (!email) return { error: "Enter your email." };
  // Same per-address throttle as resendVerificationAction: without it, this
  // endpoint is an unlimited mail-spend pipe AND an oracle (timing/volume).
  if (!authThrottled(email)) {
    return { ok: "If an account exists, a reset link is on its way." };
  }
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
  const tokenR = field(formData.get("token"), FIELD_LIMITS.short, { label: "Token" });
  if (!tokenR.ok) return { error: tokenR.error };
  const token = tokenR.value;
  const password = String(formData.get("password") ?? "");
  const pwErr = passwordTooLong(password);
  if (pwErr) return { error: pwErr };
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
  // The step-up marker is a second credential: leaving it behind on logout
  // hands the next browser user a 15-minute privileged marker. Clear it.
  const { cookies } = await import("next/headers");
  (await cookies()).delete("medilink-stepup");
  redirect("/sign-in");
}
