export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Badge, EmptyState, Alert } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { records } from "@/server/modules/records/service";
import { EmergencyProfileForm } from "@/components/patient-forms";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Emergency profile" };

export default async function EmergencyProfile() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const [bloodGroup, allergies, meds, conds] = await Promise.all([
    records.bloodGroup(patient.id),
    records.currentAllergies(patient.id),
    records.currentMedications(patient.id),
    records.currentConditions(patient.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Emergency profile"
        description="The critical minimum an emergency doctor sees through audited break-glass access — nothing more."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <CardHeader eyebrow="What doctors see" title="Critical information" />
            <dl className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <dt className="text-ink-soft">Blood group</dt>
                <dd className="flex items-center gap-2">
                  <span className="num font-semibold text-ink">
                    {bloodGroup.verified?.value ?? bloodGroup.selfReported ?? "Unknown"}
                  </span>
                  {bloodGroup.verified ? (
                    <Badge tone="pine">verified {formatDate(bloodGroup.verified.date, "short")}</Badge>
                  ) : (
                    <Badge>self-reported</Badge>
                  )}
                </dd>
              </div>
              {bloodGroup.conflict ? (
                <div className="bg-alert-tint px-4 py-2 text-[12px] text-alert sm:px-5">
                  ⚠ Self-reported ({bloodGroup.selfReported}) conflicts with the verified lab value
                  above — the verified value is shown to doctors.
                </div>
              ) : null}
              <div className="px-4 py-3 sm:px-5">
                <dt className="mb-1.5 text-ink-soft">Allergies</dt>
                <dd className="space-y-1">
                  {allergies.length ? (
                    allergies.map((a) => (
                      <p key={a.id} className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-alert">{a.substance}</span>
                        <span className="text-xs text-ink-soft">
                          {[a.criticality, a.reaction].filter(Boolean).join(" · ")}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="text-ink-faint">None documented</p>
                  )}
                </dd>
              </div>
              <div className="px-4 py-3 sm:px-5">
                <dt className="mb-1.5 text-ink-soft">Active medications</dt>
                <dd className="space-y-0.5">
                  {meds.length ? (
                    meds.map((m) => (
                      <p key={m.id} className="text-ink">
                        {m.medication}
                        <span className="text-xs text-ink-soft">
                          {" "}
                          {[m.dose, m.frequency].filter(Boolean).join(" ")}
                        </span>
                      </p>
                    ))
                  ) : (
                    <p className="text-ink-faint">None documented</p>
                  )}
                </dd>
              </div>
              <div className="px-4 py-3 sm:px-5">
                <dt className="mb-1.5 text-ink-soft">Major conditions</dt>
                <dd className="space-y-0.5">
                  {conds.filter((c) => c.status !== "resolved").map((c) => (
                    <p key={c.id} className="text-ink">
                      {c.name}
                      <span className="text-xs text-ink-soft">
                        {c.onsetDate ? ` · since ${formatDate(c.onsetDate, "short")}` : ""}
                      </span>
                    </p>
                  ))}
                  {!conds.filter((c) => c.status !== "resolved").length ? (
                    <p className="text-ink-faint">None documented</p>
                  ) : null}
                </dd>
              </div>
            </dl>
          </Card>

          <Alert tone="alert" title="How break-glass works">
            A verified doctor must state a clinical reason, gets 60 minutes of access to the
            critical profile only, you are notified immediately, and the event is permanently
            audited and queued for review.
          </Alert>
        </div>

        <Card>
          <CardHeader eyebrow="Keep current" title="Edit emergency details" />
          <EmergencyProfileForm
            initial={{
              bloodGroup: patient.bloodGroupSelfReported,
              ecName: patient.emergencyContactName,
              ecPhone: patient.emergencyContactPhone,
            }}
          />
        </Card>
      </div>
    </>
  );
}
