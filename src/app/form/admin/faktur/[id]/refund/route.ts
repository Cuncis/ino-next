import { refundAction } from "@/server/admin/inventory-actions";

/** POST /admin/faktur/{id}/refund: Catat Refund. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/faktur/[id]/refund">) {
  return refundAction(request, (await params).id);
}
