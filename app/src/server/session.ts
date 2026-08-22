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
