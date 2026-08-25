export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader, EmptyState, Card, CardHeader, Badge } from "@/components/ui";
import { SectionTabs } from "@/components/section-tabs";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { records } from "@/server/modules/records/service";
import { provenance } from "@/server/modules/records/provenance";
import { search } from "@/server/modules/search/service";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { TimelineFilter } from "@/components/timeline-filter";
import { ClinicalList, type ClinicalItem } from "@/components/clinical-rows";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Health record",
  description: "Your full clinical history and source documents in one place, with provenance.",
};

const TABS = [
  { key: "timeline", label: "Timeline" },
  { key: "documents", label: "Documents" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Timeline event kind → search-chunk recordType (shared with the filter above). */
function mapKind(kind: string): string {
  const map: Record<string, string> = {
    condition: "condition",
    allergy: "allergy",
    medication: "medication_statement",
    observation: "observation",
    procedure: "procedure",
    immunization: "immunization",
    encounter: "encounter",
    document: "document",
    report: "diagnostic_report",
  };
  return map[kind] ?? kind;
}

/** timeline kind → version resourceType. */
function resourceTypeFor(kind: string): string {
  const map: Record<string, string> = {
    condition: "condition",
    allergy: "allergy",
    medication: "medication_statement",
    observation: "observation",
    procedure: "procedure",
    immunization: "immunization",
    report: "diagnostic_report",
  };
  return map[kind] ?? kind;
}

// Module-scope for render purity: a "processing" extraction older than
// 10 minutes is dead (after() caps at maxDuration=60).
const EXTRACTION_STALE_MS = 10 * 60 * 1000;
function effectiveStatus(d: { extractionStatus: string; createdAt: Date }): string {
  if (
    d.extractionStatus === "processing" &&
    Date.now() - d.createdAt.getTime() > EXTRACTION_STALE_MS
  )
    return "failed";
  return d.extractionStatus;
}

export default async function PatientRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; kind?: string; corrected?: string }>;
}) {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const { tab: rawTab, q, kind, corrected } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "timeline";

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Health record"
        description="Everything on record, newest first — with source documents attached. This is not a complete medical history."
      />
      <SectionTabs
        tabs={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          href:
            t.key === "timeline"
              ? `/portal/patient/record${q ? `?q=${encodeURIComponent(q)}` : ""}`
              : "/portal/patient/record?tab=documents",
          allowed: true,
          active: t.key === tab,
        }))}
      />
      {tab === "timeline" ? (
        <Suspense fallback={null}>
          <TimelineSection
            patientId={patient.id}
            q={q}
            kind={kind}
            corrected={corrected}
          />
        </Suspense>
      ) : (
        <DocumentsSection patientId={patient.id} />
      )}
    </>
  );
}

/* ---------------- Timeline ---------------- */

async function TimelineSection({
  patientId,
  q,
  kind,
  corrected,
}: {
  patientId: string;
  q?: string;
  kind?: string;
  corrected?: string;
}) {
  let events = await records.timeline(patientId);
  const showCorrected = corrected === "1";

  if (kind) events = events.filter((e) => e.kind === kind);

  // Text search: FTS over record content; hits are keyed by kind+recordId,
  // matching timeline events surface with their snippet as detail.
  let snippets = new Map<string, string>();
  if (q?.trim()) {
    const hits = await search.inPatient(patientId, q.trim(), 30);
    snippets = new Map(hits.map((h) => [`${h.recordType}-${h.recordId}`, h.snippet]));
    events = events.filter((e) => snippets.has(`${mapKind(e.kind)}-${e.id}`));
  }

  // Batched provenance for chips/drawers: sealed versions when present,
  // fallback descriptors from the rows' own provenance columns otherwise.
  const provenanceRows = await provenance.forPatient(patientId);
  const items: ClinicalItem[] = events.map((e) => {
    const rt = resourceTypeFor(e.kind);
    const p = provenanceRows.get(e.id);
    return {
      id: e.id,
      kind: e.kind,
      resourceType: rt,
      label: e.label,
      date: e.date,
      detail: [e.detail, q?.trim() ? snippets.get(`${mapKind(e.kind)}-${e.id}`) : null]
        .filter(Boolean)
        .join(" · ") || null,
      trust: e.trust,
      value: (e.payload?.value as string | undefined) ?? null,
      valueString: (e.payload?.valueString as string | undefined) ?? null,
      unit: e.unit ?? null,
      referenceRangeLow: e.referenceRangeLow ?? null,
      referenceRangeHigh: e.referenceRangeHigh ?? null,
      flag: e.flag ?? null,
      provenance: p ? { ...p, label: e.label } : null,
    };
  });

  // Corrected history: superseded originals under their own neutral section.
  const supersededEvents = showCorrected ? await records.supersededFor(patientId) : [];
  const supersededItems: ClinicalItem[] = supersededEvents.map((e) => ({
    id: e.id,
    kind: e.kind,
    resourceType: resourceTypeFor(e.kind),
    label: e.label,
    date: e.date,
    detail: e.detail,
    trust: e.trust,
    superseded: true,
    payload: e.payload,
    provenance: provenanceRows.get(e.id)
      ? { ...provenanceRows.get(e.id)!, label: e.label }
      : null,
  }));

  // Group by year, newest first
  const byYear = new Map<string, ClinicalItem[]>();
  for (const e of items) {
    const year = e.date ? e.date.slice(0, 4) : "Undated";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(e);
  }
  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));

  const hasAnyCorrected = supersededItems.length > 0 || showCorrected;

  return (
    <>
      <Suspense fallback={null}>
        <TimelineFilter basePath="/portal/patient/record" />
      </Suspense>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-faint">
          {items.length} entr{items.length === 1 ? "y" : "ies"} on record — this is not a
          complete medical history.
        </p>
        {hasAnyCorrected ? (
          <Link
            href={showCorrected ? "/portal/patient/record" : "/portal/patient/record?corrected=1"}
            className="shrink-0 rounded-full border border-line-strong bg-paper-raised px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
          >
            {showCorrected ? "Hide corrected history" : "Show corrected history"}
          </Link>
        ) : null}
      </div>
      {(q?.trim() || kind) && items.length === 0 ? (
        <EmptyState
          title={`No matches${q ? ` for “${q.trim()}”` : ""}${kind ? ` in ${kind.replace(/_/g, " ")}` : ""}`}
          body={
            kind
              ? "A kind filter is active — it may be hiding the match. Clear the filters above and try again."
              : "Try a different term or clear the filters."
          }
        />
      ) : items.length === 0 && !showCorrected ? (
        <EmptyState title="Nothing on the timeline yet" body="Verified doctors and labs add events as they care for you." />
      ) : (
        <div className="space-y-8">
          {years.map((year) => (
            <section key={year} aria-label={year}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="num text-xl font-semibold text-ink">{year}</h2>
                <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
              <Card>
                <ClinicalList items={byYear.get(year)!} allowDispute />
              </Card>
            </section>
          ))}
          {showCorrected ? (
            <section aria-label="Corrected history">
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xl font-semibold text-ink">Corrected history</h2>
                <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
              {supersededItems.length ? (
                <Card>
                  <CardHeader
                    eyebrow="Kept for the record"
                    title="Superseded originals"
                  />
                  <ClinicalList items={supersededItems} allowDispute />
                </Card>
              ) : (
                <EmptyState
                  title="No corrected records"
                  body="When a doctor corrects a record, the original appears here, clearly marked superseded."
                />
              )}
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

/* ---------------- Documents ---------------- */

async function DocumentsSection({ patientId }: { patientId: string }) {
  const docs = await records.documentsFor(patientId);
  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));

  if (docs.length === 0) {
    return <EmptyState title="No documents yet" body="Labs and doctors you visit will file reports here." />;
  }

  return (
    <>
      <p className="mb-4 text-[12px] text-ink-faint">
        Original reports exactly as uploaded by verified facilities. Their hash is on
        record — tampering is detectable.{" "}
        <Link href="/portal/patient/documents" className="font-medium text-pine underline underline-offset-2">
          Open full documents view →
        </Link>
      </p>
      <Card>
        <ul className="divide-y divide-line">
          {docs.map((d) => {
            const status = effectiveStatus(d);
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{d.title}</p>
                    <Badge>{d.kind.replace(/_/g, " ")}</Badge>
                    {status === "done" ? (
                      <Badge tone="pine">structured ✓</Badge>
                    ) : status === "failed" ? (
                      <Badge tone="amber">extraction failed</Badge>
                    ) : status === "processing" ? (
                      <Badge>extracting…</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {formatDate(d.recordedDate ?? d.createdAt)}
                    {d.organizationId ? ` · ${orgName.get(d.organizationId) ?? "Facility"}` : ""}
                    {" · "}
                    <span className="num" title="SHA-256 content hash">{d.contentHash.slice(0, 10)}…</span>
                  </p>
                </div>
                <a
                  href={`/api/files/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-line-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink-faint"
                >
                  Open ↗
                </a>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
