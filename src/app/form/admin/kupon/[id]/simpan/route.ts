import { updateCrmAction } from "@/server/admin/crm-actions";

/** POST /admin/kupon/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/kupon/[id]/simpan">) {
  return updateCrmAction(request, "kupon", (await params).id);
}
