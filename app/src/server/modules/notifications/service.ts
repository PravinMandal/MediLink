/**
 * In-app notifications (email/SMS/WhatsApp adapters can subscribe later).
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";

export const notify = {
  async push(input: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    link?: string;
  }) {
    await db.insert(notifications).values(input);
  },

  async forUser(userId: string, limit = 50) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async unreadCount(userId: string): Promise<number> {
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      );
    return rows.length;
  },

  async markRead(userId: string, id: string) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  },

  async markAllRead(userId: string) {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  },
};
