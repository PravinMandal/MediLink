"use server";

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { portalHomeForRole } from "@/server/session";
import type { User } from "@/server/db/schema";

export type FormState = { error?: string; ok?: string };

const ROLE_VALUES = new Set([
  "patient",
  "doctor",
  "lab_staff",
  "org_admin",
]);

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  try {
    const res = await auth.api.signInEmail({
      body: { email, password },
    } as never);
    const user = (res as { user?: { role?: User["role"] } }).user;
    if (next && next.startsWith("/")) redirect(next);
    redirect(portalHomeForRole(user?.role ?? "patient"));
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
  if (!ROLE_VALUES.has(role)) return { error: "Choose a valid role." };

  try {
    await auth.api.signUpEmail({
      body: { name, email, password, role },
    } as never);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message?.includes("NEXT_REDIRECT")) throw err;
    if (/already|exist/i.test(message)) {
      return { error: "An account with this email already exists. Sign in instead." };
    }
    return { error: "Could not create the account. Try again." };
  }

  // Sign in immediately after signup
  try {
    await auth.api.signInEmail({ body: { email, password } } as never);
  } catch {
    redirect("/sign-in");
  }
  redirect(portalHomeForRole(role as User["role"]));
}

export async function signOutAction() {
  const { headers } = await import("next/headers");
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
