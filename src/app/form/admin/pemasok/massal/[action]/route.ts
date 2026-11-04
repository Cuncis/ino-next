import { catalogBulkAction } from "@/server/admin/catalog-actions";

/** POST /admin/pemasok/massal/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pemasok/massal/[action]">) {
  return catalogBulkAction(request, "pemasok", (await params).action);
}
