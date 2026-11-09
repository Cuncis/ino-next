import { jsonBody } from "@/lib/http";
import { can } from "@/lib/permissions";
import { validate, validationErrorResponse } from "@/lib/validation";
import { adminActionContext, toastJson } from "@/server/admin/action-response";
import { findAdminOrder } from "@/server/admin/orders";
import { handOverPickup, PickupCodeError } from "@/server/orders/pickup-code";

/** POST /admin/pengambilan/{id}/serahkan: "Serahkan" on the counter's list, with the customer's code. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pengambilan/[id]/serahkan">) {
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, "Pesanan:Proses"));

  if (response) {
    return response;
  }

  const order = await findAdminOrder(Number((await params).id), staff);

  if (!order || order.deletedAt !== null) {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  const body = await jsonBody(request);
  const { data, errors } = validate<{ code: string }>(body, { code: ["required", "string", "max:10"] }, {}, { code: locale === "en" ? "pickup Code" : "kode Ambil" }, locale);

  if (errors) {
    return validationErrorResponse(errors);
  }

  try {
    await handOverPickup(order, data.code, staff);
  } catch (error) {
    // only PickupCodeException is shown, as in Laravel; anything else is a server error
    if (!(error instanceof PickupCodeError)) throw error;

    return toastJson(locale, { status: "danger", title: error.message });
  }

  return toastJson(locale, { status: "success", title: "Pesanan #:number berhasil diserahkan.", replace: { number: order.number } });
}
