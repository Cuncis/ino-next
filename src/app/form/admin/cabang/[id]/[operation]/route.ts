import { accessOperationAction } from "@/server/admin/access-actions";

/** POST /admin/cabang/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/cabang/[id]/[operation]">) {
  const { id, operation } = await params;

  return accessOperationAction(request, "cabang", id, operation);
}
