import { crmBulkAction } from "@/server/admin/crm-actions";

/** POST /admin/kupon/massal/{hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/kupon/massal/[action]">) {
  return crmBulkAction(request, "kupon", (await params).action);
}
