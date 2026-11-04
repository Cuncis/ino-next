import { initialStockAction } from "@/server/admin/inventory-actions";

/** POST /admin/inventaris/stok/awal: Tambah Stok Awal. */
export const POST = (request: Request) => initialStockAction(request);
