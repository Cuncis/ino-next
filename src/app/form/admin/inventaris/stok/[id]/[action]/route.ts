import { stockRowAction } from "@/server/admin/inventory-actions";

/** POST /admin/inventaris/stok/{id}/{sesuaikan|terima}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/inventaris/stok/[id]/[action]">) {
  const { id, action } = await params;

  return stockRowAction(request, id, action);
}
