import { accessBulkAction } from "@/server/admin/access-actions";

/** POST /admin/cabang/massal/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/cabang/massal/[action]">) {
  return accessBulkAction(request, "cabang", (await params).action);
}
