import { catalogBulkAction } from "@/server/admin/catalog-actions";

/** POST /admin/kategori/massal/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/kategori/massal/[action]">) {
  return catalogBulkAction(request, "kategori", (await params).action);
}
