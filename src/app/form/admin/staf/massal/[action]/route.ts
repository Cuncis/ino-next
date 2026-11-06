import { accessBulkAction } from "@/server/admin/access-actions";

/** POST /admin/staf/massal/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/staf/massal/[action]">) {
  return accessBulkAction(request, "staf", (await params).action);
}
