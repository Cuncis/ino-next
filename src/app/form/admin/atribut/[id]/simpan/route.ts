import { updateCatalogAction } from "@/server/admin/catalog-actions";

/** POST /admin/atribut/{id}/simpan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/atribut/[id]/simpan">) {
  return updateCatalogAction(request, "atribut", (await params).id);
}
