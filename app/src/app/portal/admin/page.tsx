export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, FileClock, Siren } from "lucide-react";
import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { requireUser } from "@/server/session";
import {
  listPendingOrganizations,
  listPendingPractitioners,
} from "@/server/modules/identity/verification";
import { emergency } from "@/server/modules/emergency/service";

export const metadata: Metadata = {
  title: "Trust centre",
  description: "Platform overview: verifications pending, emergency events to review, audit health.",
};

/**
 * Admin home (§6.4): a calm queue summary instead of one cluttered page.
 * Each workstream has its own page in the sidebar; this shows counts and
 * the most urgent items only.
 */
export default async function AdminPage() {
  const user = await requireUser();
  // Hard role gate (§6.4): the overview itself must not leak queue counts to
  // non-admins. Sub-pages enforce this too.
  if (user.role !== "platform_admin") {
    return (
      <>
        <PageHeader eyebrow="Platform admin" title="Trust centre" />
        <Card className="mt-5">
          <div className="px-4 py-4 text-sm text-ink-soft sm:px-5">
            This console is restricted to platform administrators.
          </div>
        </Card>
      </>
    );
  }

  const [pendingPractitioners, pendingOrgs, allPendingEmergency] = await Promise.all([
    listPendingPractitioners(),
    listPendingOrganizations(),
    emergency.pendingReview(1000),
  ]);

  const queues = [
    {
      href: "/portal/admin/verification",
      icon: BadgeCheck,
      title: "Provider verification",
      count: pendingPractitioners.length + pendingOrgs.length,
      detail: `${pendingPractitioners.length} practitioners · ${pendingOrgs.length} organizations`,
      urgent: (pendingPractitioners.length + pendingOrgs.length) > 0,
    },
    {
      href: "/portal/admin/emergency",
      icon: Siren,
      title: "Emergency review",
      count: 0, // filled below
      detail: "Break-glass events awaiting disposition",
      urgent: false,
    },
    {
      href: "/portal/admin/audit",
      icon: FileClock,
      title: "Audit trail",
      count: null as number | null,
      detail: "Hash-chained event log with checkpoints",
      urgent: false,
    },
  ];

  // Inline: the five longest-waiting events (pendingReview is newest-first).
  const oldestPending = [...allPendingEmergency]
    .sort((a, b) => a.accessedAt.getTime() - b.accessedAt.getTime())
    .slice(0, 5);
  queues[1]!.count = allPendingEmergency.length;
  queues[1]!.urgent = allPendingEmergency.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Platform admin"
        title="Trust centre"
        description="Admins verify professionals and facilities and oversee exceptional access. Clinical records are never readable from this console."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {queues.map((q) => {
          const Icon = q.icon;
          const isCount = typeof q.count === "number";
          return (
            <Link
              key={q.href}
              href={q.href}
              className="glass-hover group flex flex-col rounded-2xl border border-line bg-paper-raised p-5"
            >
              <div className="flex items-center justify-between">
                <span
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pine to-pine-deep text-on-pine shadow-sm"
                >
                  <Icon size={18} />
                </span>
                {q.urgent ? <Badge tone="amber">action needed</Badge> : null}
              </div>
              <p className="mt-3.5 text-[15px] font-semibold tracking-tight text-ink">{q.title}</p>
              {isCount ? (
                <p className="num mt-1 text-[28px] font-bold leading-none text-ink">
                  {q.count === 0 ? (
                    <span className="text-ink-faint">0</span>
                  ) : (
                    q.count
                  )}
                </p>
              ) : (
                <p className="mt-2 text-[13px] font-medium leading-snug text-ink">
                  {q.detail}
                </p>
              )}
              {isCount ? (
                <p className="mt-1.5 text-[12px] leading-snug text-ink-faint">{q.detail}</p>
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Most urgent emergency events inline */}
      {oldestPending.length ? (
        <Card className="mt-6">
          <CardHeader
            eyebrow="Oldest first matters here"
            title="Emergency events awaiting review"
            action={
              <Link href="/portal/admin/emergency" className="text-[13px] font-medium text-pine underline underline-offset-2">
                Review all →
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {oldestPending.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <Badge tone="alert">break-glass</Badge>
                <span className="num text-[12px] text-ink-faint">{formatWhen(e.accessedAt)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{e.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function formatWhen(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
