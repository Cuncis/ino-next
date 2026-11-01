import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db, notifications } from "@/db";
import type { AdminLocale } from "@/lib/admin-i18n";
import { diffForHumans } from "@/lib/diff-for-humans";

/**
 * The staff member's bell (Filament's database notifications): the newest 50, unread
 * first in count, "mark all as read", "clear", and the × that deletes one.
 */
const STAFF_MODEL = "App\\Models\\User";

const mine = (userId: number) => and(eq(notifications.notifiableType, STAFF_MODEL), eq(notifications.notifiableId, userId));

type FilamentData = {
  title?: string | null;
  body?: string | null;
  actions?: { label?: string; url?: string | null; color?: string | null; shouldOpenUrlInNewTab?: boolean }[];
};

export type BellNotification = {
  id: string;
  title: string;
  body: string | null;
  date: string;
  unread: boolean;
  actions: { label: string; url: string | null; newTab: boolean }[];
};

export async function unreadNotificationCount(userId: number): Promise<number> {
  const [{ unread }] = await db.select({ unread: count() }).from(notifications).where(and(mine(userId), isNull(notifications.readAt)));

  return unread;
}

export async function bellNotifications(userId: number, locale: AdminLocale): Promise<BellNotification[]> {
  const rows = await db.select().from(notifications).where(mine(userId)).orderBy(desc(notifications.createdAt)).limit(50);

  return rows
    .filter((row) => (row.data as { format?: string }).format === "filament")
    .map((row) => {
      const data = row.data as FilamentData;

      return {
        id: row.id,
        title: data.title ?? "",
        body: data.body ?? null,
        date: row.createdAt ? diffForHumans(row.createdAt, locale) : "",
        unread: row.readAt === null,
        actions: (data.actions ?? []).map((action) => ({ label: action.label ?? "", url: action.url ?? null, newTab: Boolean(action.shouldOpenUrlInNewTab) })),
      };
    });
}

export async function markAllNotificationsRead(userId: number): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(mine(userId), isNull(notifications.readAt)));
}

export async function clearNotifications(userId: number): Promise<void> {
  await db.delete(notifications).where(mine(userId));
}

export async function deleteNotification(userId: number, id: string): Promise<void> {
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    await db.delete(notifications).where(and(mine(userId), eq(notifications.id, id)));
  }
}
