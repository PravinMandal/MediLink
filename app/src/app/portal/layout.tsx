import { requireUser } from "@/server/session";
import { PortalShell } from "@/components/portal-shell";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { notify } from "@/server/modules/notifications/service";

function timeAgo(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  // Bell data rides the layout request; keeps every portal page consistent.
  const [items, unread] = await Promise.all([
    notify.forUser(user.id, 8),
    notify.unreadCount(user.id),
  ]);
  return (
    <PortalShell
      role={user.role}
      name={user.name}
      verificationStatus={user.verificationStatus}
      notificationBell={
        <>
          <ThemeToggle />
          <NotificationBell
            unread={unread}
            items={items.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            createdAt: timeAgo(n.createdAt),
            timeISO: n.createdAt.toISOString(),
            readAt: n.readAt ? n.readAt.toISOString() : null,
          }))}
          />
        </>
      }
    >
      {!user.emailVerified ? (
        <div
          role="status"
          className="mb-5 flex flex-col gap-2 rounded-2xl border border-amber/40 bg-amber-tint px-4 py-3 text-[13px] leading-relaxed text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <strong className="font-semibold">Verify your email</strong> — it protects
            password resets and emergency alerts. Check your inbox (and spam).
          </span>
          <a
            href={`/verify-email?email=${encodeURIComponent(user.email)}`}
            className="shrink-0 rounded-xl border border-line-strong bg-paper-raised px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-pine hover:text-pine"
          >
            Resend link
          </a>
        </div>
      ) : null}
      {children}
    </PortalShell>
  );
}
