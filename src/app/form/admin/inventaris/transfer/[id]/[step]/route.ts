import { transferStepAction } from "@/server/admin/inventory-actions";

/** POST /admin/inventaris/transfer/{id}/{kirim|terima|batalkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/inventaris/transfer/[id]/[step]">) {
  const { id, step } = await params;

  return transferStepAction(request, id, step);
}
