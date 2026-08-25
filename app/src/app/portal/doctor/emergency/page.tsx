export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Alert } from "@/components/ui";
import { BreakGlassForm } from "@/components/doctor-forms";

export const metadata: Metadata = {
  title: "Emergency access",
  description: "Break-glass access to the critical emergency profile — audited and time-boxed.",
};

/**
 * Dedicated emergency-access page (§6.2 #3): deliberately separated from
 * routine discovery. The form itself enforces step-up auth, reason minimum,
 * rate limit, and audit; this page frames it with the policy facts.
 */
export default async function EmergencyAccessPage() {

  return (
    <>
      <PageHeader
        eyebrow="Urgent"
        title="Emergency access"
        description="Time-boxed break-glass into a patient's critical emergency profile. Every event is audited, rate-limited, and reviewed."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader eyebrow="Break-glass" title="Start an emergency window" />
          <div className="px-4 py-4 sm:px-5">
            <BreakGlassForm patientId={undefined} />
          </div>
        </Card>

        <div className="space-y-4">
          <Alert tone="alert" title="This is exceptional access">
            Emergency access unlocks only the minimal emergency data set for
            60 minutes. The patient is notified immediately, every read is
            individually audited, and the event enters the review queue.
          </Alert>
          <Alert tone="amber" title="Abuse has consequences">
            Repeated or flagged events block new ones pending review. Only use
            when the patient cannot consent and delay risks harm.
          </Alert>
        </div>
      </div>
    </>
  );
}
