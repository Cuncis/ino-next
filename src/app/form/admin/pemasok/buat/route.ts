import { createCatalogAction } from "@/server/admin/catalog-actions";

/** POST /admin/pemasok/buat. */
export const POST = (request: Request) => createCatalogAction(request, "pemasok");
