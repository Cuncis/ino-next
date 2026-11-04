import { productBulkAction } from "@/server/admin/product-actions";

/** POST /admin/produk/massal/{maks-pembelian|status|hapus|hapus-permanen|pulihkan}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/produk/massal/[action]">) {
  return productBulkAction(request, (await params).action);
}
