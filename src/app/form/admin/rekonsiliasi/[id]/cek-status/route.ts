import { checkPaymentAction } from "@/server/admin/inventory-actions";

/** POST /admin/rekonsiliasi/{id}/cek-status: Cek Status. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/rekonsiliasi/[id]/cek-status">) {
  return checkPaymentAction(request, (await params).id);
}
