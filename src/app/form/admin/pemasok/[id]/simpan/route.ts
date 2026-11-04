import { updateCatalogAction } from "@/server/admin/catalog-actions";

/** POST /admin/pemasok/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pemasok/[id]/simpan">) {
  return updateCatalogAction(request, "pemasok", (await params).id);
}
