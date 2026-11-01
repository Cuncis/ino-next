import { bellNotifications, unreadNotificationCount } from "@/server/admin/database-notifications";
import { staffForAction } from "@/server/admin/staff-guard";

/** GET /form/admin/notifikasi: the bell's list and unread count (polled every 30 seconds). */
export async function GET(request: Request) {
  const { staff, locale, response } = await staffForAction(request);

  if (response) {
    return response;
  }

  const [unread, list] = await Promise.all([unreadNotificationCount(staff.id), bellNotifications(staff.id, locale)]);

  return Response.json({ unread, notifications: list });
}
