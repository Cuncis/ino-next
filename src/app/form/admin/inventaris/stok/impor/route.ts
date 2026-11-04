import { importStockAction } from "@/server/admin/inventory-actions";

/** POST /admin/inventaris/stok/impor: Import Stok. */
export const POST = (request: Request) => importStockAction(request);
