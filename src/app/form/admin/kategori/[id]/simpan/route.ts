import { updateCatalogAction } from "@/server/admin/catalog-actions";

/** POST /admin/kategori/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/kategori/[id]/simpan">) {
  return updateCatalogAction(request, "kategori", (await params).id);
}
