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
  const u = session.user as unknown as Record<string, unknown>;
  return {
    ...session.user,
    role: (u.role as User["role"]) ?? "patient",
    phone: (u.phone as string | null) ?? null,
    organizationId: (u.organizationId as string | null) ?? null,
    verificationStatus:
      (u.verificationStatus as User["verificationStatus"]) ?? "unverified",
  } as SessionUser;
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
