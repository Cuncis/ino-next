import { stockDownloadAction } from "@/server/admin/inventory-actions";

/** GET /form/admin/inventaris/stok/ekspor: Export Stok. */
export const GET = (request: Request) => stockDownloadAction(request, "ekspor");
