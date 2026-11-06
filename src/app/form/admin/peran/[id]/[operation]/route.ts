import { accessOperationAction } from "@/server/admin/access-actions";

/** POST /admin/peran/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/peran/[id]/[operation]">) {
  const { id, operation } = await params;

  return accessOperationAction(request, "peran", id, operation);
}
