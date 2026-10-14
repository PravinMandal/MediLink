export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { patientService } from "@/server/modules/patients/service";
import { audit } from "@/server/modules/audit/service";
import { formatTime, formatAuditAction } from "@/lib/utils";

export const metadata: Metadata = { title: "Access history", description: "Every read of your record, including emergency access events." };

const PAGE_SIZE = 25;

export default async function AccessHistory({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const patient = await patientService.forUser(user.id);
  if (!patient) return <EmptyState title="No patient record linked to this account." />;

  const { page: rawPage } = await searchParams;
  const total = await audit.countForPatient(patient.id);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(Number.parseInt(rawPage ?? "1", 10) || 1, 1), pageCount);

  // +1 overhang: presence of a 26th row means "next" exists
  const events = await audit.forPatient(patient.id, page * PAGE_SIZE + 1);
  const pageEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasNext = page < pageCount;

  return (
    <>
      <PageHeader
        eyebrow="Patient portal"
        title="Access history"
        description="A tamper-evident log of every action on your record. Each entry is hash-chained to the one before it."
      />
      {total === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {pageEvents.map((e) => {
              const isEmergency = e.action.startsWith("emergency");
              return (
                <li
                  key={e.seq}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className={"text-sm font-medium " + (isEmergency ? "text-alert" : "text-ink")}>
                      {formatAuditAction(e.action)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {formatTime(e.createdAt)}
                      {e.reason ? ` · “${e.reason}”` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEmergency ? <Badge tone="alert">Break-glass</Badge> : null}
                    <span className="num text-[10px] text-ink-faint" title="Hash chain">
                      #{e.seq} · {e.hash.slice(0, 8)}…
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {pageCount > 1 ? (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5"
            >
              <span className="num text-xs text-ink-soft">
                Page {page} of {pageCount} · {total} events
              </span>
              <span className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={`/portal/patient/access-history?page=${page - 1}`}
                    rel="prev"
                    className="rounded-lg border border-line-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink-faint"
                  >
                    ← Previous
                  </Link>
                ) : null}
                {hasNext ? (
                  <Link
                    href={`/portal/patient/access-history?page=${page + 1}`}
                    rel="next"
                    className="rounded-lg border border-line-strong bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink-faint"
                  >
                    Next →
                  </Link>
                ) : null}
              </span>
            </nav>
          ) : null}
        </Card>
      )}
    </>
  );
}
