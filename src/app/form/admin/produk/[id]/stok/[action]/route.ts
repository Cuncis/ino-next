import { productStockAction } from "@/server/admin/inventory-actions";

/** POST /admin/produk/{id}/stok/{terima-barang|sesuaikan-stok}: the product page's stock buttons. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/produk/[id]/stok/[action]">) {
  const { id, action } = await params;

  return productStockAction(request, id, action);
}
