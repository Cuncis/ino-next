import { crmBulkAction } from "@/server/admin/crm-actions";

/** POST /admin/pelanggan/massal/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pelanggan/massal/[action]">) {
  return crmBulkAction(request, "pelanggan", (await params).action);
}
