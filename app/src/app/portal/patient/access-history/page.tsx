export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { audit } from "@/server/modules/audit/service";
import { formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Access history" };

const ACTION_LABEL: Record<string, string> = {
  "document.viewed": "Viewed a source document",
  "document.uploaded": "Uploaded a document",
  "ai.summary.generated": "Generated an AI summary",
  "consent.granted": "You granted access",
  "consent.revoked": "You revoked access",
  "consent.requested": "Requested access to your records",
  "emergency.break_glass": "EMERGENCY ACCESS USED",
  "record.condition.created": "Added a condition",
  "record.allergy.created": "Added an allergy",
  "record.medication.created": "Added a medication",
  "record.procedure.created": "Added a procedure",
  "record.encounter.created": "Recorded an encounter",
  "patient.created": "Record created",
  "patient.profile.updated": "You updated your profile",
};

export default async function AccessHistory() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const events = await audit.forPatient(patient.id, 200);

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Access history"
        description="A tamper-evident log of every action on your record. Each entry is hash-chained to the one before it."
      />
      {events.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {events.map((e) => {
              const isEmergency = e.action.startsWith("emergency");
              return (
                <li
                  key={e.seq}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className={"text-sm font-medium " + (isEmergency ? "text-alert" : "text-ink")}>
                      {ACTION_LABEL[e.action] ?? e.action}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {formatTime(e.createdAt)}
                      {e.reason ? ` · “${e.reason}”` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEmergency ? <Badge tone="alert">Break-glass</Badge> : null}
                    <span className="num text-[10px] text-ink-faint" title="Hash chain">
                      #{e.seq} · {e.hash.slice(0, 8)}…
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
