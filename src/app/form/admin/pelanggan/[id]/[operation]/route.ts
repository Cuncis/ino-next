import { crmOperationAction } from "@/server/admin/crm-actions";

/** POST /admin/pelanggan/{id}/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pelanggan/[id]/[operation]">) {
  const { id, operation } = await params;

  return crmOperationAction(request, "pelanggan", id, operation);
}
