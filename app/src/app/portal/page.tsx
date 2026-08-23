export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser, portalHomeForRole } from "@/server/session";

export default async function PortalIndex() {
  const user = await getSessionUser();
  // Unauthenticated visitors go straight to sign-in (the middleware usually
  // already did; this makes the dispatcher's intent explicit).
  if (!user) redirect("/sign-in");
  redirect(portalHomeForRole(user.role));
}
