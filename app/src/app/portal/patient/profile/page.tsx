export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { ProfileForm } from "@/components/patient-forms";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile" };

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
              ["Patient ID", patient.id],
              ["City", patient.addressCity ?? "—"],
              ["Record created", formatDate(patient.createdAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <dt className="text-ink-soft">{k}</dt>
                <dd className={"text-ink " + (k.includes("ID") ? "num text-xs" : "")}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-line px-4 py-3 sm:px-5">
            <Badge>ABHA linkage arrives with the ABDM integration</Badge>
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Editable" title="Contact details" />
          <ProfileForm
            initial={{
              name: user.name,
              phone: user.phone,
              city: patient.addressCity,
              patientPhone: patient.phone,
            }}
          />
        </Card>
      </div>
    </>
  );
}
