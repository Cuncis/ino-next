import { catalogOperationAction } from "@/server/admin/catalog-actions";

/** POST /admin/kategori/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/kategori/[id]/[operation]">) {
  const { id, operation } = await params;

  return catalogOperationAction(request, "kategori", id, operation);
}
