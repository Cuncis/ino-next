import { updateAccessAction } from "@/server/admin/access-actions";

/** POST /admin/cabang/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/cabang/[id]/simpan">) {
  return updateAccessAction(request, "cabang", (await params).id);
}
