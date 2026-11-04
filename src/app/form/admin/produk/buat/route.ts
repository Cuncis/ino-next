import { createProductAction } from "@/server/admin/product-actions";

/** POST /admin/produk/buat: CreateProduct. */
export const POST = (request: Request) => createProductAction(request);
