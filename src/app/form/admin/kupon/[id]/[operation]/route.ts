import { crmOperationAction } from "@/server/admin/crm-actions";

/** POST /admin/kupon/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/kupon/[id]/[operation]">) {
  const { id, operation } = await params;

  return crmOperationAction(request, "kupon", id, operation);
}
