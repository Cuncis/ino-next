import { catalogTemplateAction } from "@/server/admin/product-actions";

/** GET /form/admin/produk/impor/template: Unduh Template. */
export const GET = (request: Request) => catalogTemplateAction(request);
