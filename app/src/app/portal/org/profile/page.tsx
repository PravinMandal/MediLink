export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { ThemeSettings } from "@/components/theme-settings";

export const metadata: Metadata = {
  title: "Profile & themes",
  description: "Facility settings and the look of MediLink.",
};

/** Org/lab profile: settings summary + one-click theme settings. */
export default async function OrgProfilePage() {
  // Every other portal page gates on role; this one rendered facility
  // settings UI to anyone (the layout does not gate — pages must).
  const { requireRole } = await import("@/server/session");
  await requireRole("lab_staff", "org_admin");
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile & themes"
        description="Facility settings and how MediLink looks."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader eyebrow="Facility" title="Organisation" />
          <div className="px-4 py-4 text-sm leading-relaxed text-ink-soft sm:px-5">
            <p>
              Facility registration, accreditation evidence, and staff
              membership are managed by your organisation admin together with
              the MediLink verification team.
            </p>
            <p className="mt-2 text-[12.5px] text-ink-faint">
              Need a change? Contact the platform administrators through
              support — every change is audited.
            </p>
            <Link href="/portal/org" className="mt-3 inline-block text-[13px] font-medium text-pine underline underline-offset-2">
              ← Back to work queue
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
