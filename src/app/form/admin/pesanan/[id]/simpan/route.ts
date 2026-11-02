import { jsonBody } from "@/lib/http";
import { validationErrorResponse } from "@/lib/validation";
import { adminActionContext, toastJson } from "@/server/admin/action-response";
import { validateOrderForm } from "@/server/admin/order-form";
import { authorizes, findAdminOrder, fulfilmentEditable, ORDER_PERMISSIONS, updateAdminOrder } from "@/server/admin/orders";

/** POST /admin/pesanan/{id}/simpan: EditOrder's "Simpan"; the page stays open. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pesanan/[id]/simpan">) {
  const { staff, locale, response } = await adminActionContext(request, (access) => authorizes(access, ORDER_PERMISSIONS, "update"));

  if (response) {
    return response;
  }

  const order = await findAdminOrder(Number((await params).id), staff);

  if (!order) {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  const { data, errors } = await validateOrderForm(await jsonBody(request), locale, fulfilmentEditable(order));

  if (errors) {
    return validationErrorResponse(errors);
  }

  await updateAdminOrder(order, data);

  return toastJson(locale, { status: "success", title: "Data berhasil disimpan" });
}
