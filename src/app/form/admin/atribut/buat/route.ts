import { createCatalogAction } from "@/server/admin/catalog-actions";

/** POST /admin/atribut/buat. */
export const POST = (request: Request) => createCatalogAction(request, "atribut");
