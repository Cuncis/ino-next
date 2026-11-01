import { deleteNotification } from "@/server/admin/database-notifications";
import { staffForAction } from "@/server/admin/staff-guard";

/** POST /admin/notifikasi/{id}/hapus: the × on one notification. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/notifikasi/[id]/hapus">) {
  const { staff, response } = await staffForAction(request);

  if (response) {
    return response;
  }

  await deleteNotification(staff.id, (await params).id);

  return Response.json({ ok: true });
}
