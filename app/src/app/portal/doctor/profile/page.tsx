export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { ThemeSettings } from "@/components/theme-settings";
import { requireUser } from "@/server/session";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Profile & themes",
  description: "Your credentials and the look of MediLink.",
};

/** Doctor profile: verification status + one-click theme settings. */
export default async function DoctorProfilePage() {
  const user = await requireUser();
  const practitioner = user.role === "doctor" ? await getPractitionerForUser(user.id) : null;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile & themes"
        description="Credentials, verification state, and how MediLink looks."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            eyebrow="Identity"
            title={practitioner?.fullName ?? user.name}
            action={
              <Badge tone={practitioner?.verificationStatus === "verified" ? "pine" : "amber"}>
                {practitioner?.verificationStatus === "verified"
                  ? "Verified"
                  : (practitioner?.verificationStatus ?? "unverified")}
              </Badge>
            }
          />
          <dl className="divide-y divide-line text-sm">
            {[
              ["Registration", practitioner?.registrationNumber],
              ["Council", practitioner?.council],
              ["Qualification", practitioner?.qualification],
              ["Specialty", practitioner?.specialty],
              ["Verified on", practitioner?.verifiedAt ? formatDate(practitioner.verifiedAt) : null],
            ].map(([label, value]) =>
              value ? (
                <div key={label as string} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <dt className="text-ink-soft">{label}</dt>
                  <dd className="num text-[13px] font-medium text-ink">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
          <div className="border-t border-line px-4 py-3 sm:px-5">
            <Link href="/portal/doctor/verification" className="text-[13px] font-medium text-pine underline underline-offset-2">
              Update credentials →
            </Link>
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader eyebrow="Appearance" title="Themes" />
          <ThemeSettings />
        </Card>
      </div>
    </>
  );
}
