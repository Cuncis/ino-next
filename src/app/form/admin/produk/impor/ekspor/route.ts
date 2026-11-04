import { exportCatalogAction } from "@/server/admin/product-actions";

/** GET /form/admin/produk/impor/ekspor: Export Produk & Stok. */
export const GET = (request: Request) => exportCatalogAction(request);
