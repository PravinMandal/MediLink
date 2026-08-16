import { redirect } from "next/navigation";
import { getSessionUser, portalHomeForRole } from "@/server/session";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect(portalHomeForRole(user.role));
  redirect("/sign-in");
}
