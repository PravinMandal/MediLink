export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, EmptyState } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { ProfileForm } from "@/components/patient-forms";
import { CopyButton } from "@/components/interactive";
import { ThemeSettings } from "@/components/theme-settings";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile", description: "Your demographics, emergency contact, and self-reported details." };

export default async function PatientProfile() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Profile"
        description="Identity basics. Clinical facts are added only by verified professionals."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Record identity" title="On file" />
          <dl className="divide-y divide-line text-sm">
            {[
              ["Full name", patient.fullName],
              ["Date of birth", patient.dob ? formatDate(patient.dob) : "—"],
              ["Sex", patient.sex ?? "—"],
              ["Record created", formatDate(patient.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
            {/* The shareable lookup identifier — never the internal UUID. */}
            {patient.patientCode ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <dt className="text-ink-soft">Patient ID</dt>
                <dd className="flex items-center gap-2">
                  <span className="num text-[13px] font-semibold tracking-wide text-ink">
                    {patient.patientCode}
                  </span>
                  <CopyButton value={patient.patientCode} label="Copy" />
                </dd>
              </div>
            ) : null}
          </dl>
        </Card>
        <Card>
          <CardHeader eyebrow="Editable" title="Contact details" />
          <ProfileForm
            initial={{
              name: user.name,
              phone: user.phone,
              city: patient.addressCity,
              patientPhone: patient.phone,
              abha: patient.abhaNumber,
            }}
          />
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader eyebrow="Appearance" title="Themes" />
        <ThemeSettings />
      </Card>
    </>
  );
}
