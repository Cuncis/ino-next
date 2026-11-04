import { importCatalogAction } from "@/server/admin/product-actions";

/** POST /admin/produk/impor/katalog: Import Produk & Stok. */
export const POST = (request: Request) => importCatalogAction(request);
