import { catalogOperationAction } from "@/server/admin/catalog-actions";

/** POST /admin/atribut/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/atribut/[id]/[operation]">) {
  const { id, operation } = await params;

  return catalogOperationAction(request, "atribut", id, operation);
}
