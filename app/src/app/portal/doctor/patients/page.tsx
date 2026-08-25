export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt } from "drizzle-orm";
import { ArrowRight, FileClock, ShieldAlert, Users } from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { consents, patients } from "@/server/db/schema";
import { getPractitionerForUser } from "@/server/modules/identity/verification";
import { SCOPE_LABELS, type ConsentScope } from "@/server/modules/consent/service";
import { daysUntil, initials, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My patients",
  description: "Everyone who has granted you access, with scopes and expiry at a glance.",
};

const PURPOSE_LABEL: Record<string, string> = {
  treatment: "Treatment",
  consultation: "Consultation",
  emergency: "Emergency",
  record_review: "Record review",
};

/**
 * My Patients (§6.2 Workspace): every patient with an active grant to this
 * practitioner. Names appear because consent exists; nothing pre-consent.
 */
export default async function MyPatientsPage() {
  const user = await requireUser();
  const practitioner = await getPractitionerForUser(user.id);

  const grants = practitioner
    ? await db
        .select({
          patientId: patients.id,
          fullName: patients.fullName,
          patientCode: patients.patientCode,
          purpose: consents.purpose,
          scopes: consents.scopes,
          expiresAt: consents.expiresAt,
        })
        .from(consents)
        .innerJoin(patients, eq(patients.id, consents.patientId))
        .where(
          and(
            eq(consents.granteePractitionerId, practitioner.id),
            eq(consents.status, "active"),
            gt(consents.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(consents.createdAt))
        .limit(100)
    : [];

  // Dedupe by patient, keep soonest-expiring grant per patient.
  const byPatient = new Map<string, (typeof grants)[number]>();
  for (const g of grants) {
    const existing = byPatient.get(g.patientId);
    if (!existing || g.expiresAt < existing.expiresAt) byPatient.set(g.patientId, g);
  }
  const roster = [...byPatient.values()].sort(
    (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime(),
  );

  return (
    <>
      <PageHeader
        eyebrow="Practice"
        title="My patients"
        description="Everyone who has granted you access — scopes, purpose, and expiry at a glance."
        action={
          <Link
            href="/portal/doctor"
            className="glass-hover inline-flex items-center gap-2 rounded-xl border border-line-strong bg-paper-raised px-4 py-2.5 text-sm font-semibold text-ink"
          >
            <Users size={16} aria-hidden className="text-pine" />
            Find a new patient
          </Link>
        }
      />

      {roster.length === 0 ? (
        <Card>
          <EmptyState
            title="No active grants yet"
            body="When a patient approves your access request — or redeems your handoff session — they appear here with their consent scope and expiry."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {roster.map((g) => {
            const days = daysUntil(g.expiresAt);
            const expiring = days <= 7;
            return (
              <li key={g.patientId}>
                <Link
                  href={`/portal/doctor/patients/${g.patientId}`}
                  className="glass-hover group flex h-full flex-col rounded-2xl border border-line bg-paper-raised p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="num flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pine to-pine-deep text-[13px] font-semibold text-on-pine shadow-sm"
                      >
                        {initials(g.fullName)}
                      </span>
                      <div>
                        <p className="font-display text-[17px] font-semibold leading-tight tracking-tight text-ink">
                          {g.fullName}
                        </p>
                        <p className="num text-[11px] text-ink-faint">{g.patientCode ?? ""}</p>
                      </div>
                    </div>
                    <ArrowRight
                      size={17}
                      aria-hidden
                      className="mt-1 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-pine"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="pine">{PURPOSE_LABEL[g.purpose] ?? g.purpose}</Badge>
                    {(g.scopes as ConsentScope[]).slice(0, 3).map((s) => (
                      <Badge key={s}>{SCOPE_LABELS[s] ?? s}</Badge>
                    ))}
                    {(g.scopes as ConsentScope[]).length > 3 ? (
                      <Badge>+{(g.scopes as ConsentScope[]).length - 3}</Badge>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[12px] text-ink-faint">
                    <span className="inline-flex items-center gap-1.5">
                      <FileClock size={13} aria-hidden />
                      {formatDate(g.expiresAt)}
                    </span>
                    {expiring ? (
                      <Badge tone="amber">
                        {days <= 0 ? "expires today" : `expires in ${days}d`}
                      </Badge>
                    ) : (
                      <span className="num">{days} days left</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-6">
        <CardHeader eyebrow="Expiring soon" title="Renewals to watch" />
        <div className="px-4 py-4 sm:px-5">
          {roster.filter((g) => daysUntil(g.expiresAt) <= 7).length ? (
            <ul className="divide-y divide-line">
              {roster
                .filter((g) => daysUntil(g.expiresAt) <= 7)
                .map((g) => (
                  <li key={g.patientId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-ink">
                      <ShieldAlert size={15} aria-hidden className="text-amber" />
                      {g.fullName}
                    </span>
                    <span className="num text-[12.5px] text-ink-faint">
                      {formatDate(g.expiresAt)} · {daysUntil(g.expiresAt)}d
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-soft">
              Nothing expiring in the next 7 days.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
