export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { PageHeader, Card, CardHeader, Badge, Alert, EmptyState } from "@/components/ui";
import { db } from "@/server/db";
import { emergencyAccessEvents, organizations, patients, practitioners, user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { audit } from "@/server/modules/audit/service";
import {
  listPendingOrganizations,
  listPendingPractitioners,
} from "@/server/modules/identity/verification";
import {
  ReviewEmergencyButtons,
  ReviewOrganizationButtons,
  ReviewPractitionerButtons,
} from "@/components/admin-forms";
import { formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Review queue" };

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "platform_admin") {
    return <Alert tone="alert" title="Platform admins only">This console is restricted.</Alert>;
  }

  const [pendingPractitioners, pendingOrgs, emergencyEvents, recentAudit] = await Promise.all([
    listPendingPractitioners(),
    listPendingOrganizations(),
    db
      .select({
        event: emergencyAccessEvents,
        practitionerName: practitioners.fullName,
        patientName: patients.fullName,
      })
      .from(emergencyAccessEvents)
      .leftJoin(practitioners, eq(practitioners.id, emergencyAccessEvents.practitionerId))
      .leftJoin(patients, eq(patients.id, emergencyAccessEvents.patientId))
      .orderBy(desc(emergencyAccessEvents.accessedAt))
      .limit(10),
    audit.recent(30),
  ]);

  const practitionerUserNames = pendingPractitioners.length
    ? await db
        .select({ id: userTable.id, name: userTable.name, email: userTable.email })
        .from(userTable)
    : [];
  const nameFor = new Map(practitionerUserNames.map((u) => [u.id, u]));

  const orgSubmitters = pendingOrgs.length
    ? await db.select({ id: organizations.id, name: organizations.name }).from(organizations)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Platform admin"
        title="Review queue"
        description="Trust is granted here. Admins verify professionals and facilities; clinical records themselves are never readable from this console."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Verification"
            title={`Practitioners pending (${pendingPractitioners.length})`}
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
            <div className="p-5"><EmptyState title="Queue clear" /></div>
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="Verification"
            title={`Facilities pending (${pendingOrgs.length})`}
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
            <div className="p-5"><EmptyState title="Queue clear" /></div>
          )}
        </Card>

        <Card>
          <CardHeader
            eyebrow="Break-glass oversight"
            title={`Emergency access events (${emergencyEvents.length})`}
          />
          {emergencyEvents.length ? (
            <ul className="divide-y divide-line">
              {emergencyEvents.map(({ event, practitionerName, patientName }) => (
                <li key={event.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {practitionerName ?? "Practitioner"} → {patientName ?? "patient"}
                    </p>
                    <Badge tone={event.reviewStatus === "pending" ? "amber" : event.reviewStatus === "flagged" ? "alert" : "pine"}>
                      {event.reviewStatus}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">“{event.reason}”</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {formatTime(event.accessedAt)} · notified{" "}
                    {event.patientNotifiedAt ? "✓" : "—"}
                  </p>
                  {event.reviewStatus === "pending" ? (
                    <div className="mt-2">
                      <ReviewEmergencyButtons eventId={event.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState title="No break-glass events" body="Emergency accesses appear here for review." /></div>
          )}
        </Card>

        <Card>
          <CardHeader eyebrow="Tamper-evident" title="Recent audit events" />
          <ul className="max-h-[520px] divide-y divide-line overflow-y-auto">
            {recentAudit.map((e) => (
              <li key={e.seq} className="flex items-center justify-between gap-2 px-4 py-2 sm:px-5">
                <div className="min-w-0">
                  <p className="num truncate text-[12px] text-ink">{e.action}</p>
                  <p className="text-[10px] text-ink-faint">{formatTime(e.createdAt)}</p>
                </div>
                <span className="num text-[10px] text-ink-faint">{e.hash.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
