export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, EmptyState } from "@/components/ui";
import { requireUser } from "@/server/session";
import {
  listPendingOrganizations,
  listPendingPractitioners,
} from "@/server/modules/identity/verification";
import { db } from "@/server/db";
import { user as userTable } from "@/server/db/schema";
import { ReviewPractitionerButtons, ReviewOrganizationButtons } from "@/components/admin-forms";

export const metadata: Metadata = {
  title: "Verification",
  description: "Approve or reject practitioner and facility credential submissions.",
};

/** Provider verification queue (§6.4 #1): practitioners + organizations. */
export default async function AdminVerificationPage() {
  const user = await requireUser();
  if (user.role !== "platform_admin") {
    return (
      <>
        <PageHeader eyebrow="Trust centre" title="Restricted" />
        <Card className="mt-5">
          <div className="px-4 py-4 text-sm text-ink-soft sm:px-5">
            This console is restricted to platform administrators.
          </div>
        </Card>
      </>
    );
  }
  const [pendingPractitioners, pendingOrgs] = await Promise.all([
    listPendingPractitioners(),
    listPendingOrganizations(),
  ]);

  // Batched to exactly the pending rows: the old query scanned the whole
  // user table (and shipped every user into the RSC payload) just to map
  // a handful of practitioner userIds to emails.
  const { inArray } = await import("drizzle-orm");
  const pendingUserIds = [...new Set(pendingPractitioners.map((p) => p.userId))];
  const practitionerUserNames = pendingUserIds.length
    ? await db
        .select({ id: userTable.id, name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(inArray(userTable.id, pendingUserIds))
    : [];
  const nameFor = new Map(practitionerUserNames.map((u) => [u.id, u]));

  return (
    <>
      <PageHeader
        eyebrow="Trust centre"
        title="Verification"
        description="Credential review for professionals and facilities. Approvals unlock clinical capability — every decision is audited."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Practitioners"
            title={`Pending (${pendingPractitioners.length})`}
          />
          {pendingPractitioners.length ? (
            <ul className="divide-y divide-line">
              {pendingPractitioners.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{p.fullName}</p>
                    <p className="text-xs text-ink-soft">
                      <span className="num">{p.registrationNumber}</span>
                      {p.council ? ` · ${p.council}` : ""}
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      {nameFor.get(p.userId)?.email ?? ""}
                    </p>
                  </div>
                  <ReviewPractitionerButtons practitionerId={p.id} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState title="Queue clear" body="No practitioner submissions waiting." /></div>
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="Facilities"
            title={`Pending (${pendingOrgs.length})`}
          />
          {pendingOrgs.length ? (
            <ul className="divide-y divide-line">
              {pendingOrgs.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-medium text-ink">{o.name}</p>
                    <p className="text-xs text-ink-soft">
                      {o.type.replace(/_/g, " ")}
                      {o.registrationNumber ? ` · ${o.registrationNumber}` : ""}
                      {o.city ? ` · ${o.city}` : ""}
                    </p>
                  </div>
                  <ReviewOrganizationButtons organizationId={o.id} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState title="Queue clear" body="No facility submissions waiting." /></div>
          )}
        </Card>
      </div>
    </>
  );
}
