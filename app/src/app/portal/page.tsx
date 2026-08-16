export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser, portalHomeForRole } from "@/server/session";

export default async function PortalIndex() {
  const user = await getSessionUser();
  redirect(portalHomeForRole(user?.role ?? "patient"));
}
