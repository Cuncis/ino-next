import { accessOperationAction } from "@/server/admin/access-actions";

/** POST /admin/staf/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/staf/[id]/[operation]">) {
  const { id, operation } = await params;

  return accessOperationAction(request, "staf", id, operation);
}
