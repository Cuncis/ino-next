import { updateAccessAction } from "@/server/admin/access-actions";

/** POST /admin/peran/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/peran/[id]/simpan">) {
  return updateAccessAction(request, "peran", (await params).id);
}
