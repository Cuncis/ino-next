import { importShopifyAction } from "@/server/admin/product-actions";

/** POST /admin/produk/impor/shopify: Import Format Shopify. */
export const POST = (request: Request) => importShopifyAction(request);
