import { stockProductSearch } from "@/server/admin/inventory-actions";

/** GET /form/admin/inventaris/produk-cari?search=: products for Tambah Stok Awal. */
export const GET = (request: Request) => stockProductSearch(request);
