export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { records } from "@/server/modules/records/service";
import { formatDate, TRUST_LABEL } from "@/lib/utils";

export const metadata: Metadata = { title: "Timeline" };

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

export default async function PatientTimeline() {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const events = await records.timeline(patient.id);

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
      {events.length === 0 ? (
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
                {byYear.get(year)!.map((e) => (
                  <li key={`${e.kind}-${e.id}`} className="relative flex gap-4 pb-5">
                    {/* spine */}
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-4 h-full w-px bg-line last:hidden"
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
                        <p className="text-sm font-medium text-ink">{e.label}</p>
                        <p className="num text-[11px] text-ink-faint">{formatDate(e.date, "short")}</p>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                        {e.detail ? <span>{e.detail}</span> : null}
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
