import { stockDownloadAction } from "@/server/admin/inventory-actions";

/** GET /form/admin/inventaris/stok/template: Unduh Template Stok. */
export const GET = (request: Request) => stockDownloadAction(request, "template");
