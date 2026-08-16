import { requireUser } from "@/server/session";
import { PortalShell } from "@/components/portal-shell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <PortalShell
      role={user.role}
      name={user.name}
      verificationStatus={user.verificationStatus}
    >
      {children}
    </PortalShell>
  );
}
