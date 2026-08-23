import { requireUser } from "@/server/session";
import { PortalShell } from "@/components/portal-shell";
import { NotificationBell } from "@/components/notification-bell";
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
      }
    >
      {children}
    </PortalShell>
  );
}
