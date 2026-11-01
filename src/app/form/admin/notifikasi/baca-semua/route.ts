import { markAllNotificationsRead } from "@/server/admin/database-notifications";
import { staffForAction } from "@/server/admin/staff-guard";

/** POST /admin/notifikasi/baca-semua. */
export async function POST(request: Request) {
  const { staff, response } = await staffForAction(request);

  if (response) {
    return response;
  }

  await markAllNotificationsRead(staff.id);

  return Response.json({ ok: true });
}
