import { catalogBulkAction } from "@/server/admin/catalog-actions";

/** POST /admin/atribut/massal/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/atribut/massal/[action]">) {
  return catalogBulkAction(request, "atribut", (await params).action);
}
