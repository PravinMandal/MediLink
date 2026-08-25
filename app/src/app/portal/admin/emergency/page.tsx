export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { PageHeader, Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { emergencyAccessEvents, patients, practitioners } from "@/server/db/schema";
import { ReviewEmergencyButtons } from "@/components/admin-forms";
import { formatTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Emergency review",
  description: "Break-glass oversight: disposition every emergency access event.",
};

/** Emergency review queue (§6.4 #2): every break-glass event with its state. */
export default async function AdminEmergencyPage() {
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

  const emergencyEvents = await db
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
    .limit(50);

  const pending = emergencyEvents.filter((e) => e.event.reviewStatus === "pending");

  return (
    <>
      <PageHeader
        eyebrow="Trust centre"
        title="Emergency review"
        description="Break-glass events with their notification state and reviewer disposition. Flagged events block that practitioner from rearming on the same patient."
        action={
          <Badge tone={pending.length ? "amber" : "pine"}>
            {pending.length} pending
          </Badge>
        }
      />

      <Card>
        <CardHeader
          eyebrow="All events"
          title={`Break-glass history (${emergencyEvents.length})`}
        />
        {emergencyEvents.length ? (
          <ul className="divide-y divide-line">
            {emergencyEvents.map(({ event, practitionerName, patientName, patientUserId }) => (
              <li key={event.id} className="px-4 py-3.5 sm:px-5">
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
    </>
  );
}
