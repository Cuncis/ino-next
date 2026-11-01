import { clearNotifications } from "@/server/admin/database-notifications";
import { staffForAction } from "@/server/admin/staff-guard";

/** POST /admin/notifikasi/bersihkan. */
export async function POST(request: Request) {
  const { staff, response } = await staffForAction(request);

  if (response) {
    return response;
  }

  await clearNotifications(staff.id);

  return Response.json({ ok: true });
}
