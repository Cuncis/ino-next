import { updateAccessAction } from "@/server/admin/access-actions";

/** POST /admin/staf/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/staf/[id]/simpan">) {
  return updateAccessAction(request, "staf", (await params).id);
}
