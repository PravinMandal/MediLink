export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { BellRing, CheckCheck } from "lucide-react";
import { PageHeader, Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { requireRole } from "@/server/session";
import { db } from "@/server/db";
import { notifications, patients, consents, practitioners } from "@/server/db/schema";
import { formatTime, formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Inbox",
  description: "Consent changes, access decisions, expiry warnings, and system notices.",
};

const TYPE_META: Record<string, { label: string; tone: "pine" | "amber" | "alert" | "neutral" | "info" }> = {
  "consent.granted": { label: "Access granted", tone: "pine" },
  "consent.requested": { label: "Request sent", tone: "info" },
  access_request: { label: "Access decision", tone: "amber" },
  record: { label: "Record update", tone: "neutral" },
  document: { label: "Document", tone: "neutral" },
  "emergency.access_used": { label: "Emergency", tone: "alert" },
};

/**
 * Doctor inbox (§6.2 #4): consent changes, decisions, expiry warnings and
 * system notices in one reverse-chronological feed. Read state is shared
 * with the bell (same notifications table).
 */
export default async function DoctorInboxPage() {
  const user = await requireRole("doctor");

  // Notifications + practitioner row are independent (both keyed off
  // user.id) — fetch together instead of in sequence.
  const [direct, practitioner] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50),
    db
      .select({ id: practitioners.id })
      .from(practitioners)
      .where(eq(practitioners.userId, user.id))
      .limit(1),
  ]);

  // …plus grants that expire within 7 days (expiry warnings are computed,
  // not stored — they always reflect live data). The window lives in the
  // WHERE clause now: the old version pulled every grant for the
  // practitioner and filtered in JS.
  const expiring: Array<{ patientName: string; expiresAt: Date; patientId: string }> = [];
  if (practitioner[0]) {
    const now = new Date();
    const soon = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const { and, gt, lte } = await import("drizzle-orm");
    const rows = await db
      .select({
        patientId: patients.id,
        patientName: patients.fullName,
        expiresAt: consents.expiresAt,
      })
      .from(consents)
      .innerJoin(patients, eq(patients.id, consents.patientId))
      .where(
        and(
          eq(consents.granteePractitionerId, practitioner[0].id),
          gt(consents.expiresAt, now),
          lte(consents.expiresAt, soon),
        ),
      )
      .limit(100);
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.patientId)) continue;
      seen.add(r.patientId);
      expiring.push(r);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Inbox"
        description="Consent changes, access decisions, and expiry warnings."
      />

      {expiring.length ? (
        <Card className="mb-5">
          <CardHeader
            eyebrow="Action suggested"
            title="Expiring access"
            action={<Badge tone="amber">{expiring.length}</Badge>}
          />
          <ul className="divide-y divide-line">
            {expiring.map((e) => (
              <li key={e.patientId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span className="font-medium text-ink">{e.patientName}</span>
                <span className="num text-[12.5px] text-amber">
                  expires {formatDate(e.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          eyebrow="All notifications"
          title="Recent activity"
          action={
            direct.length ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
                <BellRing size={13} aria-hidden />
                {direct.filter((n) => !n.readAt).length} unread
              </span>
            ) : undefined
          }
        />
        {direct.length ? (
          <ul className="divide-y divide-line">
            {direct.map((n) => {
              const meta = TYPE_META[n.type] ?? { label: n.type, tone: "neutral" as const };
              return (
                <li key={n.id} className={`flex gap-3 px-4 py-3.5 sm:px-5 ${n.readAt ? "opacity-70" : ""}`}>
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-line-strong" : "bg-pine shadow-[0_0_6px_1px_color-mix(in_srgb,var(--prim-pine-300)_60%,transparent)]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    {n.body ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{n.body}</p> : null}
                    <p className="mt-1 text-[11.5px] text-ink-faint">{formatTime(n.createdAt)}</p>
                  </div>
                  {n.link ? (
                    <a
                      href={n.link}
                      className="glass-hover mt-1 inline-flex h-8 shrink-0 items-center rounded-lg border border-line px-3 text-[12px] font-medium text-pine"
                    >
                      Open
                      <CheckCheck size={13} aria-hidden className="ml-1 opacity-40" />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState
              title="Nothing here yet"
              body="When a patient grants or declines access — or a record you follow changes — it shows up here."
            />
          </div>
        )}
      </Card>
    </>
  );
}
