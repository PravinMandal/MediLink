export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import { PageHeader, Card, CardHeader, Badge, Alert, EmptyState } from "@/components/ui";
import { db } from "@/server/db";
import { emergencyAccessEvents, patients, practitioners, user as userTable } from "@/server/db/schema";
import { requireUser } from "@/server/session";
import { audit } from "@/server/modules/audit/service";
import {
  listPendingOrganizations,
  listPendingPractitioners,
} from "@/server/modules/identity/verification";
import {
  GrantRoleForm,
  ReviewEmergencyButtons,
  ReviewOrganizationButtons,
  ReviewPractitionerButtons,
  VerifyAuditChainButton,
} from "@/components/admin-forms";
import { formatTime, formatAuditAction } from "@/lib/utils";

export const metadata: Metadata = { title: "Review queue", description: "Verify practitioner registrations and organizations." };

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
        patientUserId: patients.userId,
      })
      .from(emergencyAccessEvents)
      .leftJoin(practitioners, eq(practitioners.id, emergencyAccessEvents.practitionerId))
      .leftJoin(patients, eq(patients.id, emergencyAccessEvents.patientId))
      .orderBy(desc(emergencyAccessEvents.accessedAt))
      .limit(10),
    (async () => {
      // Audit stream with actor + patient context: the tamper-evidence story
      // must be readable, not just hashes.
      const events = await audit.recent(30);
      const userIds = [...new Set(events.map((e) => e.actorId).filter((x): x is string => !!x))];
      const patientIds = [...new Set(events.map((e) => e.patientId).filter((x): x is string => !!x))];
      const [users, patientRows] = await Promise.all([
        userIds.length
          ? db
              .select({ id: userTable.id, name: userTable.name, role: userTable.role })
              .from(userTable)
              .where(inArray(userTable.id, userIds))
          : Promise.resolve([]),
        patientIds.length
          ? db
              .select({ id: patients.id, fullName: patients.fullName })
              .from(patients)
              .where(inArray(patients.id, patientIds))
          : Promise.resolve([]),
      ]);
      const userById = new Map(users.map((u) => [u.id, u]));
      const patientById = new Map(patientRows.map((p) => [p.id, p]));
      return events.map((e) => ({
        ...e,
        actor: e.actorId ? userById.get(e.actorId) : undefined,
        patient: e.patientId ? patientById.get(e.patientId) : undefined,
      }));
    })(),
  ]);

  const practitionerUserNames = pendingPractitioners.length
    ? await db
        .select({ id: userTable.id, name: userTable.name, email: userTable.email })
        .from(userTable)
    : [];
  const nameFor = new Map(practitionerUserNames.map((u) => [u.id, u]));

  // Non-admin accounts eligible for a professional role grant.
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
            action={
              emergencyEvents.length >= 10 ? (
                <Badge tone="amber">latest 10</Badge>
              ) : undefined
            }
          />
          {emergencyEvents.length ? (
            <ul className="divide-y divide-line">
              {emergencyEvents.map(({ event, practitionerName, patientName, patientUserId }) => (
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
                  {event.reviewNotes ? (
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      Reviewer note: {event.reviewNotes}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {formatTime(event.accessedAt)} ·{" "}
                    {event.patientNotifiedAt
                      ? `notified ${formatTime(event.patientNotifiedAt)}`
                      : patientUserId
                        ? "notification pending"
                        : "no patient account — contact on file"}
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
          <CardHeader eyebrow="Administration" title="Grant role" />
          <GrantRoleForm users={grantableUsers} />
        </Card>

        <Card>
          <CardHeader eyebrow="Tamper-evident" title="Recent audit events" />
          <VerifyAuditChainButton />
          <ul
            tabIndex={0}
            role="region"
            aria-label="Recent audit events (scrollable)"
            className="max-h-[520px] divide-y divide-line overflow-y-auto"
          >
            {recentAudit.map((e) => (
              <li key={e.seq} className="flex items-center justify-between gap-2 px-4 py-2 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-ink">
                    <span className="font-medium">{formatAuditAction(e.action)}</span>
                    {e.actor ? (
                      <span className="text-ink-soft">
                        {" "}
                        · {e.actor.name}
                        <span className="text-ink-faint"> ({e.actor.role.replace(/_/g, " ")})</span>
                      </span>
                    ) : null}
                    {e.patient ? <span className="text-ink-soft"> · {e.patient.fullName}</span> : null}
                  </p>
                  <p className="text-[10px] text-ink-faint">{formatTime(e.createdAt)}</p>
                </div>
                <span className="num text-[10px] text-ink-faint" title="Hash chain">
                  #{e.seq} · {e.hash.slice(0, 8)}…
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
