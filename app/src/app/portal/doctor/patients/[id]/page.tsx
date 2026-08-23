export const dynamic = "force-dynamic";

// Upload + after() extraction can exceed the 10s Hobby default; 60s is the
// documented D8 function cap we budget for.
export const maxDuration = 60;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PageHeader,
  Card,
  CardHeader,
  Badge,
  Alert,
  EmptyState,
} from "@/components/ui";
import { ClaimLine } from "@/components/interactive";
import { SectionTabs } from "@/components/section-tabs";
import {
  GenerateSummaryForm,
  AddRecordForm,
  UploadDocumentForm,
  RequestAccessForm,
  BreakGlassForm,
} from "@/components/doctor-forms";
import { RecordSearchForm } from "@/components/record-search";
import { RetryExtractionButton } from "@/components/retry-extraction";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { access, EMERGENCY_SCOPES, scopeForResource } from "@/server/modules/access/guard";
import { records } from "@/server/modules/records/service";
import { search } from "@/server/modules/search/service";
import { summarizer } from "@/server/modules/ai/summarize";
import { contradictionEngine } from "@/server/modules/ai/contradictions";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { audit } from "@/server/modules/audit/service";
import { formatDate, cn, ageFrom, TRUST_LABEL } from "@/lib/utils";
import type { ConsentScope } from "@/server/modules/consent/service";

export const metadata: Metadata = {
  title: "Patient record",
  description: "Consent-scoped patient record: summary, timeline, lab trends, and source documents.",
};

/* ---------------- Sparkline (deterministic SVG) ---------------- */

function Sparkline({
  points,
  unit,
  flag,
}: {
  points: Array<{ value: number; date: string | null }>;
  unit: string | null;
  flag: string;
}) {
  const W = 120;
  const H = 32;
  if (points.length < 2) return <span className="text-xs text-ink-faint">—</span>;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (W - 6) + 3;
    const y = H - 5 - ((p.value - min) / span) * (H - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1]!;
  const first = points[0]!;
  const direction =
    last.value > first.value
      ? "rising"
      : last.value < first.value
        ? "falling"
        : "steady";
  const color =
    flag === "high" || flag === "critical"
      ? "var(--color-alert)"
      : flag === "low"
        ? "var(--color-amber)"
        : "var(--color-pine)";
  return (
    <span className="inline-flex items-center">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        aria-hidden
        className="overflow-visible"
      >
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={coords[coords.length - 1]!.split(",")[0]}
          cy={coords[coords.length - 1]!.split(",")[1]}
          r="2.5"
          fill={color}
        />
        <title>{`Latest ${last.value} ${unit ?? ""} (${formatDate(last.date, "short")})`}</title>
      </svg>
      <span className="sr-only">
        Latest {last.value} {unit ?? ""} on {formatDate(last.date, "short")}, trend {direction}{" "}
        over {points.length} values (from {first.value} to {last.value}).
      </span>
    </span>
  );
}

/* ---------------- Page ---------------- */

const TABS: Array<{ key: string; label: string; scopes: ConsentScope[] }> = [
  { key: "summary", label: "Summary", scopes: [] },
  { key: "timeline", label: "Timeline", scopes: [] },
  { key: "labs", label: "Labs & trends", scopes: ["lab_results"] },
  { key: "documents", label: "Documents", scopes: ["documents"] },
  { key: "contribute", label: "Add / upload", scopes: [] },
];

export default async function DoctorPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, q: rawQ } = await searchParams;
  const user = await requireUser();

  const patient = await patientService.byId(id);
  if (!patient) notFound();

  const decision = await access.check(
    { id: user.id, role: user.role, organizationId: user.organizationId },
    patient.id,
    "*",
  );
  const practitioner = user.role === "doctor" ? await getPractitionerForUser(user.id) : null;

  /* ---------- No access path ---------- */
  if (!decision.allowed) {
    return (
      <>
        <PageHeader
          eyebrow="Doctor portal"
          title={patient.fullName}
          description={`${patient.sex ?? ""} ${patient.dob ? `· b. ${formatDate(patient.dob)}` : ""}`}
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader eyebrow="Consent required" title="No active consent from this patient" />
            <div className="px-4 py-4 sm:px-5">
              {practitioner ? <RequestAccessForm patientId={patient.id} /> : <EmptyState title="Practitioner profile required" />}
            </div>
          </Card>
          {practitioner?.verificationStatus === "verified" ? (
            <div className="space-y-4">
              <p className="eyebrow">True emergency?</p>
              <BreakGlassForm patientId={patient.id} />
            </div>
          ) : null}
        </div>
      </>
    );
  }

  /* ---------- Audited view ---------- */
  // Audit only the initial view (no ?tab= param). Tab switches re-render
  // this page server-side; auditing each would flood the trail without
  // adding information — the first view already records this user opened
  // this patient's record.
  if (!rawTab) {
    await audit.record({
      actorId: user.id,
      actorRole: user.role,
      patientId: patient.id,
      action: "patient.viewed",
      resourceType: "patient",
      resourceId: patient.id,
      metadata: { via: decision.via },
    });
  }

  const scopes = decision.scopes;
  const can = (s: ConsentScope) => scopes.includes(s);
  const viaEmergency = decision.via === "emergency";
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as string) : "summary";

  const age = ageFrom(patient.dob);
  const ageDob = age != null ? `${age}y · b. ${formatDate(patient.dob, "short")}` : "";

  // Fetch only what the consent allows — never query what the grantee can't see.
  const [bloodGroup, allergies, meds, conds, summary, conflicts, span] = await Promise.all([
    can("demographics") ? records.bloodGroup(patient.id, patient.bloodGroupSelfReported) : null,
    can("allergies") ? records.currentAllergies(patient.id) : [],
    can("medications") ? records.currentMedications(patient.id) : [],
    can("conditions") ? records.currentConditions(patient.id) : [],
    // Scope-gated read: a stored summary from broader consent is not shown
    // to a grantee with narrower scopes (decision D12).
    summarizer.latestFor(patient.id, decision.scopes),
    contradictionEngine.openFor(patient.id),
    can("conditions") ? records.encounterSpan(patient.id) : null,
  ]);

  const activeConds = conds.filter((c) => c.status !== "resolved");
  const criticalAllergies = allergies.filter(
    (a) => a.criticality?.toLowerCase().includes("high") || a.criticality?.toLowerCase() === "critical",
  );

  return (
    <>
      {viaEmergency ? (
        <div className="mb-4 rounded-lg border border-alert bg-alert px-4 py-3 text-on-alert">
          <p className="text-sm font-semibold">
            EMERGENCY ACCESS ACTIVE — critical scopes only, 60-minute window, patient notified,
            event audited for review.
          </p>
        </div>
      ) : null}

      <PageHeader
        eyebrow={viaEmergency ? "Emergency view" : "Doctor portal"}
        title={patient.fullName}
        description={`${patient.sex ?? ""} ${ageDob ? `· ${ageDob}` : ""} · access via ${decision.via}${patient.abhaNumber ? ` · ABHA ${patient.abhaNumber}` : ""}`}
        action={undefined}
      />

      {/* At a glance — the "10-second" band: blood group anchor, red-line
          allergies, active problems, last encounter, in one viewport. */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Blood group anchor — the single most emergency-critical datum.
            Not a Card: it's a filled tile, not a paper surface. */}
        {can("demographics") ? (
          <div className="relative flex flex-col justify-between overflow-hidden rounded-[10px] border border-pine bg-pine p-4 text-on-pine">
            <p className="eyebrow eyebrow-on-fill text-on-pine-soft">Blood group</p>
            <p className="num font-display text-4xl font-bold leading-none tracking-tight">
              {bloodGroup?.verified?.value ?? bloodGroup?.selfReported ?? "—"}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-on-pine-soft">
              {bloodGroup?.verified
                ? "lab-verified"
                : bloodGroup?.selfReported
                  ? "self-reported"
                  : "unknown"}
              {bloodGroup?.conflict ? " · ⚠ conflicts with self-report" : ""}
            </p>
          </div>
        ) : null}
        <Card className="border-l-2 border-l-alert p-4">
          <p className="eyebrow mb-2 text-alert">Red-line allergies</p>
          {can("allergies") ? (
            criticalAllergies.length ? (
              <ul className="space-y-1.5">
                {criticalAllergies.slice(0, 3).map((a) => (
                  <li key={a.id} className="text-sm font-semibold text-alert">
                    {a.substance}
                    <span className="font-normal text-ink-soft">
                      {" "}
                      {[a.criticality, a.reaction].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
                {allergies.length > criticalAllergies.length ? (
                  <li className="text-[11px] text-ink-faint">
                    +{allergies.length - criticalAllergies.length} lower-severity
                  </li>
                ) : null}
              </ul>
            ) : allergies.length ? (
              <p className="text-sm text-ink-faint">
                {allergies.length} documented, none high-severity
              </p>
            ) : (
              <p className="text-sm text-ink-faint">None documented</p>
            )
          ) : (
            <p className="text-sm text-ink-faint">Not in consent scope</p>
          )}
          <ProvenanceLine
            date={allergies[0]?.recordedAt ?? allergies[0]?.createdAt}
            trust={allergies[0]?.trust}
          />
        </Card>
        <Card className="p-4">
          <p className="eyebrow mb-2">Active problems</p>
          {can("conditions") ? (
            activeConds.length ? (
              <ul className="space-y-1">
                {activeConds.slice(0, 3).map((c) => (
                  <li key={c.id} className="text-[13px] text-ink">
                    {c.name}
                    <span className="text-ink-faint">
                      {" "}
                      {c.onsetDate ? `· ${formatDate(c.onsetDate, "short")}` : ""}
                    </span>
                  </li>
                ))}
                {activeConds.length > 3 ? (
                  <li className="text-[11px] text-ink-faint">+{activeConds.length - 3} more</li>
                ) : null}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">None</p>
            )
          ) : (
            <p className="text-sm text-ink-faint">Not in consent scope</p>
          )}
          <ProvenanceLine
            date={activeConds[0]?.recordedAt ?? activeConds[0]?.createdAt}
            trust={activeConds[0]?.trust}
          />
        </Card>
        <Card className="p-4">
          <p className="eyebrow mb-2">Active medications</p>
          {can("medications") ? (
            meds.length ? (
              <ul className="space-y-1">
                {meds.slice(0, 3).map((m) => (
                  <li key={m.id} className="text-[13px] text-ink">
                    {m.medication}
                    <span className="text-ink-faint">
                      {" "}
                      {[m.dose, m.frequency].filter(Boolean).join(" ")}
                    </span>
                  </li>
                ))}
                {meds.length > 3 ? (
                  <li className="text-[11px] text-ink-faint">+{meds.length - 3} more</li>
                ) : null}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">None</p>
            )
          ) : (
            <p className="text-sm text-ink-faint">Not in consent scope</p>
          )}
          <ProvenanceLine date={meds[0]?.recordedAt ?? meds[0]?.createdAt} trust={meds[0]?.trust} />
        </Card>
        <Card className="p-4">
          <p className="eyebrow mb-2">Record activity</p>
          {span ? (
            <>
              <p className="text-[13px] text-ink">
                Last encounter{" "}
                <span className="num font-medium">{formatDate(span.last, "short")}</span>
              </p>
              <p className="mt-1 text-[11.5px] text-ink-faint">
                {span.count} encounters · history since {formatDate(span.first, "short")}
              </p>
              {allergies?.length || meds.length || activeConds.length ? (
                <p className="num mt-2 text-[11px] text-ink-soft">
                  {activeConds.length} problems · {meds.length} meds · {allergies?.length ?? 0} allergies
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-faint">No encounters on file</p>
          )}
        </Card>
      </div>

      {conflicts.length && can("lab_results") ? (
        <div className="mb-5">
          <Alert tone="amber" title={`${conflicts.length} data conflict(s) detected on this record`}>
            {conflicts.map((c) => c.kind.replace(/_/g, " ")).join(" · ")} — conflicting values are
            flagged, never silently resolved.
          </Alert>
        </div>
      ) : null}

      {/* Tabs (URL-state) */}
      <SectionTabs
        tabs={TABS.map((t) => {
          const allowed = viaEmergency
            ? t.scopes.every((s) => EMERGENCY_SCOPES.includes(s)) || t.scopes.length === 0
            : true;
          return {
            key: t.key,
            label: t.label,
            href: `/portal/doctor/patients/${patient.id}?tab=${t.key}`,
            allowed,
            active: tab === t.key,
          };
        })}
      />

      {/* ---------------- Summary tab ---------------- */}
      {tab === "summary" ? (
        <div role="tabpanel" aria-label="Summary" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">Search this record</p>
            <RecordSearchForm patientId={patient.id} />
          </div>
          {rawQ ? <RecordSearchResults patientId={patient.id} q={rawQ} scopes={scopes} /> : null}
          <Card>
            <CardHeader
              eyebrow="AI-generated summary"
              title="SBAR summary"
              action={
                summary ? (
                  <Badge tone={summary.summary.mode === "llm" ? "info" : "neutral"}>
                    {summary.summary.mode === "llm"
                      ? `LLM · ${summary.summary.model}`
                      : "deterministic"}
                  </Badge>
                ) : null
              }
            />
            {summary ? (
              <div className="space-y-5 px-4 py-4 sm:px-5">
                {(
                  [
                    ["situation", "Situation"],
                    ["background", "Background"],
                    ["assessment", "Assessment"],
                    ["plan", "Plan"],
                  ] as const
                ).map(([section, label]) => {
                  const claims = summary.claims.filter((c) => c.section === section);
                  if (!claims.length) return null;
                  return (
                    <section key={section}>
                      <p className="eyebrow mb-2">{label}</p>
                      <ul className="space-y-2">
                        {claims.map((c) => (
                          <ClaimLine
                            key={c.id}
                            text={c.text}
                            sources={c.sources}
                            tone={c.text.startsWith("⚠") ? "alert" : undefined}
                          />
                        ))}
                      </ul>
                    </section>
                  );
                })}
                <p className="border-t border-line pt-3 text-[11px] text-ink-faint">
                  AI-generated — verify against sources. Every statement links to the records it
                  was built from. Generated {formatDate(summary.summary.createdAt)}.
                </p>
              </div>
            ) : (
              <div className="px-4 py-4 sm:px-5">
                <EmptyState
                  title="No summary yet"
                  body="Generate one — every claim will carry numbered citations to the underlying records."
                />
              </div>
            )}
            <div className="border-t border-line">
              <GenerateSummaryForm patientId={patient.id} hasSummary={!!summary} />
            </div>
          </Card>
        </div>
      ) : null}

      {/* ---------------- Timeline tab ---------------- */}
      {tab === "timeline" ? (
        <div role="tabpanel" aria-label="Timeline">
          <TimelineSection patientId={patient.id} scopes={scopes} />
        </div>
      ) : null}

      {/* ---------------- Labs tab ---------------- */}
      {tab === "labs" ? (
        <div role="tabpanel" aria-label="Labs and trends">
          <LabsSection patientId={patient.id} allowed={can("lab_results")} />
        </div>
      ) : null}

      {/* ---------------- Documents tab ---------------- */}
      {tab === "documents" ? (
        <div role="tabpanel" aria-label="Documents">
          <DocumentsSection patientId={patient.id} allowed={can("documents")} />
        </div>
      ) : null}

      {/* ---------------- Contribute tab ---------------- */}
      {tab === "contribute" ? (
        <div role="tabpanel" aria-label="Add or upload">
        {practitioner?.verificationStatus === "verified" ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                eyebrow="Signed by you"
                title="Add a clinical record"
                action={<span className="seal">✓ {practitioner.fullName}</span>}
              />
              <AddRecordForm patientId={patient.id} />
            </Card>
            <Card>
              <CardHeader eyebrow="Originals preserved" title="Upload a source document" />
              <UploadDocumentForm patientId={patient.id} />
            </Card>
          </div>
        ) : (
          <Alert tone="amber" title="Verification required">
            Only verified practitioners can contribute records.
          </Alert>
        )}
        </div>
      ) : null}
    </>
  );
}

/* ---------------- Sections ---------------- */

/** Extraction staleness: a "processing" doc older than 10 minutes is dead
 *  (the after() window caps at maxDuration=60) — surface as failed so the
 *  retry affordance shows. Module-scope helper for render purity. */
const EXTRACTION_STALE_MS = 10 * 60 * 1000;
function effectiveExtractionStatus(d: {
  extractionStatus: string;
  createdAt: Date;
}): string {
  if (
    d.extractionStatus === "processing" &&
    Date.now() - d.createdAt.getTime() > EXTRACTION_STALE_MS
  )
    return "failed";
  return d.extractionStatus;
}

/** Trust-ranked provenance micro-line for glance data: seal when verified,
 *  plain when not — the "where did this fact come from" answer at a glance. */
function ProvenanceLine({ date, trust }: { date?: Date | string | null; trust?: string | null }) {
  if (!date && !trust) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-faint">
      {trust === "verified" ? <span className="seal">✓</span> : null}
      <span>
        {trust && trust !== "verified" ? `${TRUST_LABEL[trust] ?? trust} · ` : ""}
        {date ? `recorded ${formatDate(date, "short")}` : ""}
      </span>
    </p>
  );
}

/**
 * Consent-scoped full-text search across the patient's record content.
 * Hits whose governing scope isn't granted are dropped server-side;
 * unknown resource kinds fail closed (scopeForResource throws → skipped).
 */
async function RecordSearchResults({
  patientId,
  q,
  scopes,
}: {
  patientId: string;
  q: string;
  scopes: string[];
}) {
  const hits = (await search.inPatient(patientId, q)).filter((h) => {
    try {
      return scopes.includes(scopeForResource(h.recordType));
    } catch {
      return false;
    }
  });

  if (!hits.length)
    return (
      <EmptyState
        title={`No matches for “${q}”`}
        body="Search covers record content within the current consent scope — allergies, conditions, medications, labs, procedures, documents."
      />
    );

  return (
    <Card>
      <CardHeader
        eyebrow="Record search"
        title={`${hits.length} match${hits.length > 1 ? "es" : ""} for “${q}”`}
      />
      <ul className="divide-y divide-line">
        {hits.map((h) => (
          <li key={h.chunkId} className="px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13.5px] font-medium text-ink">{h.label}</p>
              <div className="flex items-center gap-2">
                <Badge>{h.recordType.replace(/_/g, " ")}</Badge>
                {h.trust === "verified" ? <span className="seal">✓</span> : null}
                {h.date ? (
                  <span className="num text-[11px] text-ink-faint">{formatDate(h.date, "short")}</span>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{h.snippet}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function TimelineSection({
  patientId,
  scopes,
}: {
  patientId: string;
  scopes: string[];
}) {
  const events = await records.timeline(patientId, { scopes });
  const visible = events.filter((e) => {
    const map: Record<string, string> = {
      condition: "conditions",
      allergy: "allergies",
      medication: "medications",
      observation: "lab_results",
      procedure: "procedures",
      immunization: "procedures",
      document: "documents",
      report: "lab_results",
      encounter: "conditions",
    };
    return scopes.includes(map[e.kind] ?? "documents");
  });

  const byYear = new Map<string, typeof visible>();
  for (const e of visible) {
    const year = e.date ? e.date.slice(0, 4) : "—";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(e);
  }

  if (!visible.length)
    return <EmptyState title="Nothing viewable in the current consent scope" />;

  return (
    <div className="space-y-6">
      {[...byYear.keys()]
        .sort((a, b) => b.localeCompare(a))
        .map((year) => (
          <section key={year}>
            <div className="mb-2.5 flex items-center gap-3">
              <h2 className="num text-lg font-semibold text-ink">{year}</h2>
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>
            <Card>
              <ul className="divide-y divide-line">
                {byYear.get(year)!.map((e) => (
                  <li
                    key={`${e.kind}-${e.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className={cn("text-[13.5px]", e.kind === "allergy" ? "font-medium text-alert" : "text-ink")}>
                        {e.label}
                      </p>
                      {e.detail ? <p className="text-[11.5px] text-ink-faint">{e.detail}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{e.kind}</Badge>
                      {e.trust === "verified" ? <span className="seal">✓</span> : null}
                      <span className="num text-[11px] text-ink-faint">
                        {formatDate(e.date, "short")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
    </div>
  );
}

async function LabsSection({
  patientId,
  allowed,
}: {
  patientId: string;
  allowed: boolean;
}) {
  if (!allowed)
    return (
      <EmptyState
        title="Lab results are outside the current consent scope"
        body="Ask the patient to add lab results to their grant."
      />
    );

  const trends = await records.trends(patientId);
  const entries = [...trends.entries()];

  if (!entries.length) return <EmptyState title="No lab data yet" />;

  // Latest value per analyte + sparkline
  return (
    <Card>
      <CardHeader
        eyebrow="Structured & trend-able"
        title="Lab values over time"
        action={<Badge tone="pine">{entries.length} analytes</Badge>}
      />
      <ul className="divide-y divide-line">
        {entries
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([name, points]) => {
            const last = points[points.length - 1];
            return (
              <li
                key={name}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-5"
              >
                <div className="min-w-36">
                  <p className="text-[13.5px] font-medium text-ink">{name}</p>
                  <p className="num text-[11px] text-ink-faint">
                    {points.length} value{points.length > 1 ? "s" : ""}
                    {last.date ? ` · latest ${formatDate(last.date, "short")}` : ""}
                  </p>
                </div>
                <Sparkline points={points} unit={last.unit} flag={last.flag} />
                <p className="num text-right text-[15px] font-semibold text-ink">
                  {last.value}
                  <span className="ml-1 text-[11px] font-normal text-ink-soft">{last.unit}</span>
                  <Badge
                    tone={
                      last.flag === "critical"
                        ? "alert"
                        : last.flag === "high"
                          ? "amber"
                          : last.flag === "low"
                            ? "amber"
                            : "pine"
                    }
                    className="ml-2"
                  >
                    {last.flag}
                  </Badge>
                </p>
              </li>
            );
          })}
      </ul>
    </Card>
  );
}

async function DocumentsSection({
  patientId,
  allowed,
}: {
  patientId: string;
  allowed: boolean;
}) {
  if (!allowed)
    return (
      <EmptyState
        title="Source documents are outside the current consent scope"
        body="Ask the patient to add documents to their grant."
      />
    );
  const docs = await records.documentsFor(patientId);
  if (!docs.length) return <EmptyState title="No documents on file" />;
  // A "processing" doc older than 10 minutes is dead — see
  // effectiveExtractionStatus above.
  const statusOf = (d: (typeof docs)[number]) => effectiveExtractionStatus(d);
  return (
    <Card>
      <CardHeader eyebrow="Evidence" title="Source documents" />
      <ul className="divide-y divide-line">
        {docs.map((d) => {
          const status = statusOf(d);
          return (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{d.title}</p>
                <p className="num text-[11px] text-ink-faint">
                  {formatDate(d.recordedDate ?? d.createdAt, "short")} · sha {d.contentHash.slice(0, 10)}…
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {status === "done" ? (
                  <Badge tone="pine">extracted</Badge>
                ) : status === "failed" ? (
                  <Badge tone="amber">extraction failed</Badge>
                ) : (
                  <Badge>extracting…</Badge>
                )}
                {status === "failed" ? (
                  <RetryExtractionButton patientId={patientId} documentId={d.id} />
                ) : null}
                <a
                  href={`/api/files/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-line-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink-faint"
                >
                  Open ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
