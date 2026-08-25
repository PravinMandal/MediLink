export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Badge, EmptyState, Alert, ButtonLink } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { records } from "@/server/modules/records/service";
import { contradictionEngine } from "@/server/modules/ai/contradictions";
import { summarizer } from "@/server/modules/ai/summarize";
import { PrintCardButton } from "@/components/print-button";
import { HandoffCard } from "@/components/handoff-card";
import {
  EvidenceSummaryShell,
  EvidenceGroup,
  EvidenceClaim,
} from "@/components/evidence-summary";
import { accessRequestsService } from "@/server/modules/consent/access-requests";
import { notify } from "@/server/modules/notifications/service";
import { audit } from "@/server/modules/audit/service";
import { formatDate, formatTime, TRUST_LABEL, formatAuditAction } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard", description: "Overview of your record: blood group, allergies, medications, and recent activity." };

export default async function PatientDashboard() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);

  if (!patient) {
    return (
      <>
        <PageHeader
          eyebrow="Patient portal"
          title={`Hello, ${user.name.split(" ")[0]}`}
          description="Your lifetime health record, controlled by you."
        />
        <EmptyState
          title="No patient record linked yet"
          body="Records created for you by a verified hospital, clinic or lab will appear here once linked. Contact your care facility to get linked."
        />
      </>
    );
  }

  const [conds, allergies, meds, docs, bloodGroup, conflicts, notifications, accessLog, summary, pendingRequests] =
    await Promise.all([
      records.currentConditions(patient.id),
      records.currentAllergies(patient.id),
      records.currentMedications(patient.id),
      records.documentsFor(patient.id),
      records.bloodGroup(patient.id),
      contradictionEngine.openFor(patient.id),
      notify.forUser(user.id, 6),
      audit.forPatient(patient.id, 6),
      // Self-access: the patient reads their own summary ungated.
      summarizer.latestFor(patient.id, null),
      // §7.6 attention strip: decisions waiting for the patient surface on
      // Home, not just in the Access centre.
      accessRequestsService.pendingForPatient(patient.id).catch(() => []),
    ]);

  const criticalConflicts = conflicts.filter((c) => c.severity === "critical");

  // Coverage note (§7.6 "Your record today"): concrete freshness language
  // instead of implying completeness. Uses the newest document + encounter.
  const lastDocDate = docs[0]
    ? (docs[0].recordedDate ? new Date(docs[0].recordedDate) : docs[0].createdAt)
    : null;
  const coverageLine = lastDocDate
    ? `Newest document on file: ${formatDate(lastDocDate)}. MediLink may not contain your complete history.`
    : "No documents on file yet. MediLink may not contain your complete history.";

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title={`Hello, ${patient.fullName.split(" ")[0]}`}
        description="Your lifetime health record — every fact carries its source."
      />

      {/* §7.6 Attention strip — only when action is required. */}
      {pendingRequests.length ? (
        <div className="mb-5">
          <Alert tone="amber" title={`${pendingRequests.length} access request${pendingRequests.length > 1 ? "s" : ""} waiting for your decision`}>
            <span>
              A clinician has asked to see part of your record. Nothing is
              shared until you decide.
            </span>{" "}
            <ButtonLink href="/portal/patient/consents" variant="secondary" size="sm" className="mt-2">
              Review {pendingRequests.length > 1 ? "requests" : "request"}
            </ButtonLink>
          </Alert>
        </div>
      ) : null}

      {criticalConflicts.length ? (
        <div className="mb-5">
          <Alert tone="alert" title="Data conflict needs your attention">
            {criticalConflicts.map((c) =>
              c.kind === "blood_group" ? (
                <span key={c.id}>
                  Your self-reported blood group ({bloodGroup.selfReported}) differs from a
                  verified lab report ({bloodGroup.verified?.value},{" "}
                  {formatDate(bloodGroup.verified?.date)}). Doctors see the verified value;
                  contact the lab if the report is wrong.
                </span>
              ) : (
                <span key={c.id}>{c.kind.replace(/_/g, " ")} conflict detected.</span>
              ),
            )}
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Snapshot */}
        <Card className="md:col-span-2">
          <CardHeader
            eyebrow="At a glance"
            title="Your health snapshot"
            action={
              <ButtonLink href="/portal/patient/record" variant="secondary" size="sm">
                Full timeline
              </ButtonLink>
            }
          />
          <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
            {[
              ["Blood group", bloodGroup.verified?.value ?? bloodGroup.selfReported ?? "—", bloodGroup.verified ? "Verified lab" : "Self-reported"],
              ["Active conditions", String(conds.filter((c) => c.status !== "resolved").length), `${conds.length} total`],
              ["Allergies", String(allergies.length), allergies[0]?.substance ?? "—"],
              ["Active medications", String(meds.length), meds[0]?.medication ?? "—"],
            ].map(([label, value, sub], i) => (
              <div key={i} className="border-b border-line px-4 py-3.5 sm:border-b-0">
                <dt className="eyebrow">{label}</dt>
                <dd className="num mt-1 text-lg font-semibold text-ink">{value}</dd>
                <dd className="mt-0.5 truncate text-[11px] text-ink-faint">{sub}</dd>
              </div>
            ))}
          </dl>
          {/* §7.6 coverage note: no false completeness, concrete freshness. */}
          <p className="border-t border-line bg-paper-sunk px-4 py-2.5 text-[12px] text-ink-soft sm:px-5">
            {coverageLine}
          </p>
        </Card>

        {/* Own evidence summary — plain language, every claim cited on the doctor's view */}
        <Card className="print-card print-full md:col-span-2">
          {summary ? (
            <EvidenceSummaryShell
              meta={`generated ${formatDate(summary.summary.createdAt)}`}
              action={
                <div className="flex items-center gap-2 print:hidden">
                  <Badge tone={summary.summary.mode === "llm" ? "info" : "neutral"}>
                    {summary.summary.mode === "llm" ? `LLM · ${summary.summary.model}` : "deterministic"}
                  </Badge>
                  <PrintCardButton label="Print summary" />
                </div>
              }
            >
              {(
                [
                  // §7.13 recorded-fact headings (patient-facing plain language).
                  ["situation", "Key facts"],
                  ["background", "Relevant history"],
                  ["assessment", "Recent changes"],
                  ["plan", "Recorded follow-up & medicines"],
                ] as const
              ).map(([section, label]) => {
                const claims = summary.claims.filter((c) => c.section === section);
                if (!claims.length) return null;
                return (
                  <EvidenceGroup key={section} label={label}>
                    {claims.slice(0, 4).map((c) => (
                      <EvidenceClaim
                        key={c.id}
                        text={c.text}
                        tone={c.text.startsWith("⚠") ? "alert" : undefined}
                      />
                    ))}
                  </EvidenceGroup>
                );
              })}
            </EvidenceSummaryShell>
          ) : (
            <>
              <CardHeader
                eyebrow="Evidence summary"
                title="Your record, in plain language"
              />
              <div className="px-4 py-4 sm:px-5">
                <EmptyState
                  title="No summary yet"
                  body="Ask your doctor to generate one at your next visit — every claim will carry citations."
                />
              </div>
            </>
          )}
        </Card>

        {/* Patient-present handoff (§8.2) */}
        <Card>
          <CardHeader
            eyebrow="Patient ID handoff"
            title="Share with a clinician now"
          />
          <HandoffCard />
        </Card>

        {/* Conditions */}
        <Card>
          <CardHeader eyebrow="History" title="Conditions" />
          <ul className="divide-y divide-line">
            {conds.length ? (
              conds.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-soft">
                      {c.status}
                      {c.onsetDate ? ` · since ${formatDate(c.onsetDate)}` : ""}
                    </p>
                  </div>
                  <Badge tone={c.trust === "verified" ? "pine" : "neutral"}>
                    {TRUST_LABEL[c.trust] ?? c.trust}
                  </Badge>
                </li>
              ))
            ) : (
              <li className="px-5 py-6">
                <EmptyState title="No conditions recorded" />
              </li>
            )}
          </ul>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader
            eyebrow="Evidence"
            title="Recent documents"
            action={
              <ButtonLink href="/portal/patient/documents" variant="secondary" size="sm">
                All {docs.length}
              </ButtonLink>
            }
          />
          <ul className="divide-y divide-line">
            {docs.slice(0, 4).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                  <p className="text-xs text-ink-soft">{formatDate(d.recordedDate ?? d.createdAt)}</p>
                </div>
                <a
                  href={`/api/files/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-pine underline underline-offset-2 hover:decoration-pine/40"
                >
                  View
                </a>
              </li>
            ))}
            {!docs.length ? (
              <li className="px-5 py-6">
                <EmptyState title="No documents yet" body="Verified labs and doctors add documents here." />
              </li>
            ) : null}
          </ul>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader eyebrow="Inbox" title="Notifications" />
          <ul className="divide-y divide-line">
            {notifications.length ? (
              notifications.map((n) => (
                <li key={n.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-xs text-ink-soft">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] text-ink-faint">{formatTime(n.createdAt)}</p>
                </li>
              ))
            ) : (
              <li className="px-5 py-6">
                <EmptyState title="Nothing yet" body="Access requests and new reports appear here." />
              </li>
            )}
          </ul>
        </Card>

        {/* Access log */}
        <Card>
          <CardHeader
            eyebrow="Your data, your rules"
            title="Recent access"
            action={
              <ButtonLink href="/portal/patient/access-history" variant="secondary" size="sm">
                Full history
              </ButtonLink>
            }
          />
          <ul className="divide-y divide-line">
            {accessLog.length ? (
              accessLog.map((e) => (
                <li key={e.seq} className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-[12.5px] text-ink">{formatAuditAction(e.action)}</p>
                    <p className="text-[11px] text-ink-faint">{formatTime(e.createdAt)}</p>
                  </div>
                  {e.action.includes("emergency") ? <Badge tone="alert">Break-glass</Badge> : null}
                </li>
              ))
            ) : (
              <li className="px-5 py-6">
                <EmptyState title="No access yet" body="Every read of your record is logged here, forever." />
              </li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
