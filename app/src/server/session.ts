import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import type { User } from "./db/schema";

export type SessionUser = User & {
  email: string;
};

/** Returns the signed-in user (with MediLink fields) or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  // Re-read the user row: role/org/verification may have been revoked or
  // granted mid-session; the session cookie alone must never authorize.
  const { db } = await import("./db");
  const { user: userTable } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!row) return null;
  return { ...row, email: row.email } as SessionUser;
});

/** Throws to the sign-in page if unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}

/* ------------------------------------------------------------------ */
/* Step-up authentication (BuildPlan §10.1, §7.12)                     */
/* ------------------------------------------------------------------ */

/**
 * A recent re-authentication marker for high-risk actions (break-glass,
 * exports). Step-up is satisfied by a password re-check within the last 15
 * minutes, recorded via `confirmStepUp`. Sessions older than that require a
 * fresh confirmation for privileged/emergency actions.
 */
const STEP_UP_TTL_MS = 15 * 60 * 1000;

const stepUpStore = new Map<string, number>();

/** Verify credentials and record a step-up confirmation for the user. */
export async function confirmStepUp(
  userId: string,
  password: string,
): Promise<boolean> {
  const { auth } = await import("./auth");
  const { db } = await import("./db");
  const { user: userTable } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, userId));
  if (!row) return false;
  try {
    await auth.api.signInEmail({
      body: { email: row.email, password },
    } as never);
  } catch {
    return false;
  }
  stepUpStore.set(userId, Date.now());
  return true;
}

/** Whether the user has a fresh step-up confirmation. */
export function hasFreshStepUp(userId: string): boolean {
  const at = stepUpStore.get(userId);
  return !!at && Date.now() - at < STEP_UP_TTL_MS;
}

/** AccessContext session assurance derived from the step-up state. */
export function sessionAssuranceFor(
  userId: string,
): "standard" | "step_up" {
  return hasFreshStepUp(userId) ? "step_up" : "standard";
}

export function portalHomeForRole(role: User["role"]): string {
  switch (role) {
    case "doctor":
      return "/portal/doctor";
    case "lab_staff":
    case "org_admin":
      return "/portal/org";
    case "platform_admin":
      return "/portal/admin";
    default:
      return "/portal/patient";
  }
}
