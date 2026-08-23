export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { records } from "@/server/modules/records/service";
import { search } from "@/server/modules/search/service";
import { TimelineFilter } from "@/components/timeline-filter";
import { formatDate, TRUST_LABEL } from "@/lib/utils";

export const metadata: Metadata = { title: "Timeline", description: "Your full clinical history in chronological order, with provenance." };

const KIND_TONE: Record<string, "pine" | "amber" | "alert" | "info" | "neutral"> = {
  condition: "info",
  allergy: "alert",
  medication: "neutral",
  observation: "pine",
  procedure: "info",
  immunization: "neutral",
  report: "neutral",
  document: "neutral",
  encounter: "neutral",
};

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

export default async function PatientTimeline({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const { q, kind } = await searchParams;
  let events = await records.timeline(patient.id);

  // Kind filter
  if (kind) events = events.filter((e) => e.kind === kind);

  // Text search: FTS over record content; hits are keyed by kind+recordId,
  // matching timeline events surface with their snippet as detail.
  let snippets = new Map<string, string>();
  if (q?.trim()) {
    const hits = await search.inPatient(patient.id, q.trim(), 30);
    snippets = new Map(hits.map((h) => [`${h.recordType}-${h.recordId}`, h.snippet]));
    events = events.filter((e) => {
      // timeline kinds map to chunk recordTypes
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
      return snippets.has(`${map[e.kind] ?? e.kind}-${e.id}`);
    });
  }

  // Group by year, newest first
  const byYear = new Map<string, typeof events>();
  for (const e of events) {
    const year = e.date ? e.date.slice(0, 4) : "Undated";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(e);
  }
  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Medical timeline"
        description="Everything on record, newest first. Each entry shows who recorded it and from which source."
      />
      <Suspense fallback={null}>
        <TimelineFilter basePath="/portal/patient/timeline" />
      </Suspense>
      {(q?.trim() || kind) && events.length === 0 ? (
        <EmptyState
          title={`No matches${q ? ` for “${q.trim()}”` : ""}${kind ? ` in ${kind.replace(/_/g, " ")}` : ""}`}
          body={
            kind
              ? "A kind filter is active — it may be hiding the match. Clear the filters above and try again."
              : "Try a different term or clear the filters."
          }
        />
      ) : events.length === 0 ? (
        <EmptyState title="Nothing on the timeline yet" body="Verified doctors and labs add events as they care for you." />
      ) : (
        <div className="space-y-8">
          {years.map((year) => (
            <section key={year} aria-label={year}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="num text-xl font-semibold text-ink">{year}</h2>
                <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
              <ol className="relative space-y-0">
                {byYear.get(year)!.map((e, i, arr) => (
                  <li key={`${e.kind}-${e.id}`} className="relative flex gap-4 pb-5">
                    {/* spine — hidden on the final item so it doesn't draw past the last dot */}
                    <span
                      aria-hidden
                      className={
                        "absolute left-[7px] top-4 h-full w-px bg-line " +
                        (i === arr.length - 1 ? "hidden" : "")
                      }
                    />
                    <span
                      aria-hidden
                      className={
                        "relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 " +
                        (e.kind === "allergy"
                          ? "border-alert bg-alert-tint"
                          : e.kind === "condition"
                            ? "border-info bg-info-tint"
                            : e.kind === "observation"
                              ? "border-pine bg-pine-tint"
                              : "border-line-strong bg-paper-raised")
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        {e.kind === "document" ? (
                          <a
                            href={`/api/files/${e.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-ink underline decoration-line-strong decoration-1 underline-offset-2 transition-colors hover:text-pine hover:decoration-pine"
                          >
                            {e.label} <span aria-hidden>↗</span>
                          </a>
                        ) : (
                          <p className="text-sm font-medium text-ink">{e.label}</p>
                        )}
                        <p className="num text-[11px] text-ink-faint">{formatDate(e.date, "short")}</p>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                        {e.detail ? <span>{e.detail}</span> : null}
                        {q?.trim() && snippets.get(`${mapKind(e.kind)}-${e.id}`) ? (
                          <span className="rounded bg-pine-tint px-1.5 py-0.5 text-[11px] text-pine-ink">
                            match: {snippets.get(`${mapKind(e.kind)}-${e.id}`)!.slice(0, 80)}…
                          </span>
                        ) : null}
                        <Badge tone={KIND_TONE[e.kind] ?? "neutral"}>{e.kind}</Badge>
                        {e.trust === "verified" ? <span className="seal">✓ Verified</span> : <span className="text-ink-faint">{TRUST_LABEL[e.trust] ?? e.trust}</span>}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
