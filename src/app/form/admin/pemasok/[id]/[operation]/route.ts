import { catalogOperationAction } from "@/server/admin/catalog-actions";

/** POST /admin/pemasok/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pemasok/[id]/[operation]">) {
  const { id, operation } = await params;

  return catalogOperationAction(request, "pemasok", id, operation);
}
