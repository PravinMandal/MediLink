export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { getSessionUser } from "@/server/session";
import { emergencyCard } from "@/server/modules/identity/emergency-card";
import { audit } from "@/server/modules/audit/service";

export const metadata: Metadata = {
  title: "Emergency scan",
  robots: { index: false },
};

/**
 * Emergency-card scan target (§7.12): /e/<opaque-token>.
 *
 * The token itself grants nothing. A signed-in, verified doctor is taken to
 * the patient's consent-gated record page — which offers audited break-glass
 * when there is no active grant and blocks everything otherwise. Any other
 * viewer (patient, admin, signed-out visitor) sees a neutral explanation,
 * never a confirmation that the token is real.
 */
export default async function EmergencyScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Preserve the scan across login: an unauthenticated treating clinician
  // returns here after sign-in instead of losing the emergency context.
  // (requireUser() would drop the token with a bare /sign-in redirect.)
  const user = await getSessionUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/e/${token}`)}`);

  if (user.role !== "doctor") {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Card>
          <CardHeader eyebrow="MediLink" title="Emergency card scanned" />
          <div className="px-4 py-4 text-sm leading-relaxed text-ink-soft sm:px-5">
            This code is for treating clinicians. If this is an emergency, call
            your local emergency number — a MediLink card never replaces 108.
          </div>
        </Card>
      </main>
    );
  }

  const resolved = await emergencyCard.resolve(token, { actorId: user.id });
  if (!resolved) {
    // Uniform outcome for unknown AND revoked tokens; audited upstream.
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Card>
          <CardHeader eyebrow="MediLink" title="This emergency code cannot be opened" />
          <div className="px-4 py-4 text-sm leading-relaxed text-ink-soft sm:px-5">
            The code may be from a reprinted card or mistyped. Ask the patient
            or family for the current card, or use Find&nbsp;a&nbsp;patient with
            their Patient ID and start emergency access from there.
          </div>
        </Card>
      </main>
    );
  }

  await audit.record({
    actorId: user.id,
    actorRole: user.role,
    patientId: resolved.patientId,
    action: "emergency_card.scanned",
    resourceType: "emergency_card_token",
  });

  redirect(`/portal/doctor/patients/${resolved.patientId}`);
}
