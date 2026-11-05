import { updateCrmAction } from "@/server/admin/crm-actions";

/** POST /admin/pelanggan/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pelanggan/[id]/simpan">) {
  return updateCrmAction(request, "pelanggan", (await params).id);
}
