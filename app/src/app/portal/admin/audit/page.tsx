export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { PageHeader, Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { requireUser } from "@/server/session";
import { audit } from "@/server/modules/audit/service";
import { db } from "@/server/db";
import {
  integrityCheckpoints,
  patients,
  user as userTable,
} from "@/server/db/schema";
import { desc, inArray } from "drizzle-orm";
import { VerifyAuditChainButton } from "@/components/admin-forms";
import { formatTime, formatAuditAction } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Audit trail",
  description: "Hash-chained audit log with integrity checkpoints.",
};

/** Audit trail page (§6.4 #3): chain verification + readable event stream. */
export default async function AdminAuditPage() {
  const user = await requireUser();
  if (user.role !== "platform_admin") {
    return (
      <>
        <PageHeader eyebrow="Trust centre" title="Restricted" />
        <Card className="mt-5">
          <div className="px-4 py-4 text-sm text-ink-soft sm:px-5">
            This console is restricted to platform administrators.
          </div>
        </Card>
      </>
    );
  }

  const [recentAudit, latestCheckpoints] = await Promise.all([
    audit.recent(60),
    db
      .select({
        id: integrityCheckpoints.id,
        lastSeq: integrityCheckpoints.lastSeq,
        manifestSha256: integrityCheckpoints.manifestSha256,
        anchoredExternally: integrityCheckpoints.anchoredExternally,
        createdAt: integrityCheckpoints.createdAt,
      })
      .from(integrityCheckpoints)
      .orderBy(desc(integrityCheckpoints.createdAt))
      .limit(3),
  ]);

  const userIds = [...new Set(recentAudit.map((e) => e.actorId).filter((x): x is string => !!x))];
  const patientIds = [...new Set(recentAudit.map((e) => e.patientId).filter((x): x is string => !!x))];
  const [users, patientRows] = await Promise.all([
    userIds.length
      ? db
          .select({ id: userTable.id, name: userTable.name, role: userTable.role })
          .from(userTable)
          .where(inArray(userTable.id, userIds))
      : Promise.resolve([]),
    patientIds.length
      ? db
          .select({ id: patients.id, fullName: patients.fullName })
          .from(patients)
          .where(inArray(patients.id, patientIds))
      : Promise.resolve([]),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const patientById = new Map(patientRows.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader
        eyebrow="Trust centre"
        title="Audit trail"
        description="Every sensitive action on a hash chain. Verify the chain and inspect checkpoints — events themselves are immutable."
        action={<VerifyAuditChainButton />}
      />

      {/* Checkpoint strip */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {latestCheckpoints.map((cp) => (
          <div key={cp.id} className="glass-hover rounded-xl border border-line bg-paper-raised p-4">
            <p className="eyebrow text-[10px]">Checkpoint</p>
            <p className="num mt-1.5 truncate font-mono text-[11px] text-ink" title={cp.manifestSha256}>
              {cp.manifestSha256.slice(0, 18)}…
            </p>
            <p className="num mt-1 text-[11px] text-ink-faint">
              seq ≤ {cp.lastSeq} · {formatTime(cp.createdAt)}
            </p>
            <Badge tone={cp.anchoredExternally ? "pine" : "neutral"} className="mt-2">
              {cp.anchoredExternally ? "anchored" : "not yet anchored"}
            </Badge>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader
          eyebrow="Event stream"
          title={`Recent (${recentAudit.length})`}
        />
        {recentAudit.length ? (
          <>
          {/* Scrollable log needs keyboard access: role="region" + label
              makes it a landmark, tabIndex={0} puts it in the tab order.
              (jsx-a11y flags ul+tabIndex, but region-landmark scroll areas
              are the documented exception.) */}
          {/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- region landmark scroll area */}
          <ul
            tabIndex={0}
            role="region"
            aria-label="Recent audit events (scrollable)"
            className="max-h-[560px] divide-y divide-line overflow-y-auto"
          >
          {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
          {recentAudit.map((e) => (
            <li key={e.seq} className="flex items-center justify-between gap-2 px-4 py-2 sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-[12px] text-ink">
                  <span className="font-medium">{formatAuditAction(e.action)}</span>
                  {e.actorId && userById.get(e.actorId) ? (
                    <span className="text-ink-soft">
                      {" "}
                      · {userById.get(e.actorId)!.name}
                      <span className="text-ink-faint"> ({userById.get(e.actorId)!.role.replace(/_/g, " ")})</span>
                    </span>
                  ) : null}
                  {e.patientId && patientById.get(e.patientId) ? (
                    <span className="text-ink-faint"> · patient {patientById.get(e.patientId)!.fullName}</span>
                  ) : null}
                </p>
                <p className="num mt-0.5 text-[10px] text-ink-faint" title={`seq ${e.seq} · hash ${e.hash}`}>
                  #{e.seq}
                </p>
              </div>
              <time className="shrink-0 text-[10.5px] text-ink-faint">{formatTime(e.createdAt)}</time>
            </li>
          ))}
          </ul>
          </>
        ) : (
          <div className="p-5">
            <EmptyState
              title="No events yet"
              body="The audit trail fills as clinicians, staff, and patients act. It is append-only and tamper-evident."
            />
          </div>
        )}
      </Card>
    </>
  );
}
