export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Badge, EmptyState, Alert } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { records } from "@/server/modules/records/service";
import { EmergencyProfileForm } from "@/components/patient-forms";
import { EmergencyCard } from "@/components/emergency-card";
import { PrintEmergencyCard } from "@/components/print-card-button";
import { RotateCardButton } from "@/components/rotate-card-button";
import { emergencyCard } from "@/server/modules/identity/emergency-card";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Emergency profile", description: "Critical information available to doctors via audited emergency access." };

export default async function EmergencyProfile() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const [bloodGroup, allergies, meds, conds, card] = await Promise.all([
    records.bloodGroup(patient.id),
    records.currentAllergies(patient.id),
    records.currentMedications(patient.id),
    records.currentConditions(patient.id),
    // Issue-or-rotate is idempotent per render; rotation revokes any earlier
    // printed card so a lost one stops resolving the moment this renders.
    emergencyCard.issue(user.id, patient.id),
  ]);
  const cardToken = card.token;

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Emergency profile"
        description="The critical minimum an emergency doctor sees through audited break-glass access — nothing more."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <EmergencyCard
              data={{
                patientName: patient.fullName,
                patientId: patient.id,
                sex: patient.sex,
                dob: patient.dob,
                bloodGroup: bloodGroup.verified?.value ?? bloodGroup.selfReported ?? "—",
                bloodGroupVerified: !!bloodGroup.verified,
                allergies: allergies.map((a) => ({
                  substance: a.substance,
                  criticality: a.criticality,
                  reaction: a.reaction,
                })),
                meds: meds.map((m) => ({
                  medication: m.medication,
                  dose: m.dose,
                  frequency: m.frequency,
                })),
                conditions: conds
                  .filter((c) => c.status !== "resolved")
                  .map((c) => ({ name: c.name, onsetDate: c.onsetDate })),
                ecName: patient.emergencyContactName,
                ecPhone: patient.emergencyContactPhone,
                // §7.12: the QR encodes an opaque, rotatable token — never a
                // raw patient URL or reusable identifier. Scanning routes an
                // authenticated clinician to /e/<token>, which resolves the
                // patient server-side and lands on the audited record page;
                // the access check there still enforces consent/break-glass.
                emergencyUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/e/${cardToken}`,
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <PrintEmergencyCard />
              <span className="mx-1 h-5 w-px bg-line" aria-hidden />
              <RotateCardButton />
              <p className="text-[11px] text-ink-faint">
                Wallet-size. The QR routes a treating doctor through the audited
                emergency path — never a silent copy.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader eyebrow="What doctors see" title="Critical information" />
            {bloodGroup.conflict ? (
              <p role="note" className="bg-alert-tint px-4 py-2 text-[12px] text-alert sm:px-5">
                ⚠ Self-reported ({bloodGroup.selfReported}) conflicts with the verified lab value
                below — the verified value is shown to doctors.
              </p>
            ) : null}
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
