import { createCatalogAction } from "@/server/admin/catalog-actions";

/** POST /admin/kategori/buat. */
export const POST = (request: Request) => createCatalogAction(request, "kategori");
