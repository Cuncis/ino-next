import { jsonBody } from "@/lib/http";
import { validationErrorResponse } from "@/lib/validation";
import { adminActionContext, toastJson } from "@/server/admin/action-response";
import { validateOrderForm } from "@/server/admin/order-form";
import { authorizes, createAdminOrder, ORDER_PERMISSIONS } from "@/server/admin/orders";

/**
 * POST /admin/pesanan/buat: CreateOrder. Then the order's page, or with "Buat & buat
 * lainnya" (`another`) an empty form again.
 */
export async function POST(request: Request) {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, ORDER_PERMISSIONS, "create"));

  if (response) {
    return response;
  }

  const body = await jsonBody(request);
  const { data, errors } = await validateOrderForm(body, locale, true);

  if (errors) {
    return validationErrorResponse(errors);
  }

  const order = await createAdminOrder(data, staff);

  return toastJson(locale, { status: "success", title: "Data berhasil dibuat" }, { redirect: body.another ? "/admin/pesanan/create" : `/admin/pesanan/${order.id}` });
}
