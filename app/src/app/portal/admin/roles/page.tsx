export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { user as userTable } from "@/server/db/schema";
import { GrantRoleForm } from "@/components/admin-forms";

export const metadata: Metadata = {
  title: "Role grants",
  description: "Grant professional roles. Platform admin is never grantable here.",
};

/** Role grants (§6.4 #5): professional roles are granted only by an admin. */
export default async function AdminRolesPage() {
  // Hard role gate: this page renders a directory of users (names + emails).
  // The server action is separately protected; the page must be too.
  const user = await requireUser();
  if (user.role !== "platform_admin") {
    return (
      <>
        <PageHeader eyebrow="Trust centre" title="Role grants" />
        <Card className="mt-5">
          <div className="px-4 py-4 text-sm text-ink-soft sm:px-5">
            This console is restricted to platform administrators.
          </div>
        </Card>
      </>
    );
  }

  const grantableUsers = (
    await db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role })
      .from(userTable)
      .orderBy(userTable.name)
      .limit(200)
  ).filter((u) => u.role !== "platform_admin");

  return (
    <>
      <PageHeader
        eyebrow="Trust centre"
        title="Role grants"
        description="Professional roles are granted only by a platform admin, always with a reason, and every grant is audited."
      />
      <Card className="max-w-2xl">
        <CardHeader eyebrow="Administration" title="Grant a role" />
        <GrantRoleForm users={grantableUsers} />
      </Card>
    </>
  );
}
