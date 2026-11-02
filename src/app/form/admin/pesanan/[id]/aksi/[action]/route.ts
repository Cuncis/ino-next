import { translate } from "@/lib/admin-i18n";
import { SHIPMENT_STATUSES, toLabel } from "@/lib/admin-options";
import { jsonBody } from "@/lib/http";
import { can } from "@/lib/permissions";
import { validate, validationErrorResponse } from "@/lib/validation";
import { adminActionContext, toastJson } from "@/server/admin/action-response";
import { findAdminOrder, orderDetail, runOrderAction, visibleOrderActions, type OrderActionKey } from "@/server/admin/orders";

/** POST /admin/pesanan/{id}/aksi/{action}: one of the order page's header actions (ViewOrder). */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/pesanan/[id]/aksi/[action]">) {
  const { staff, access, locale, response } = await adminActionContext(request, (rights) => can(rights, "Pesanan:Proses"));

  if (response) {
    return response;
  }

  const { id, action } = await params;
  const order = await findAdminOrder(Number(id), staff);

  if (!order) {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  const { shipment } = await orderDetail(order);

  // an action that isn't offered for the order as it is now is refused, as Filament does
  if (!visibleOrderActions(order, shipment, access).includes(action as OrderActionKey)) {
    return Response.json({ message: "This action is unauthorized." }, { status: 403 });
  }

  const body = await jsonBody(request);

  if (action === "handOver") {
    const attribute = locale === "en" ? "pickup Code" : "kode Ambil";
    const { errors } = validate(body, { code: ["required", "string", "max:10"] }, {}, { code: attribute }, locale);

    if (errors) {
      return validationErrorResponse(errors);
    }
  }

  const outcome = await runOrderAction(action as OrderActionKey, order, staff, body, (status) => {
    const label = toLabel(SHIPMENT_STATUSES, status);

    return label ? translate(locale, label) : status;
  });

  return toastJson(locale, outcome);
}
