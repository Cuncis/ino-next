import { previousUrl, redirectTo } from "@/lib/http";
import { cancelOrder } from "@/server/orders/order-cancellation";
import { notFoundResponse } from "@/server/shop/cart-lookups";
import { customerForAction } from "@/server/shop/customer-guard";
import { findCustomerOrder, isCancellableByCustomer } from "@/server/shop/orders";

const NOT_CANCELLABLE = "Pesanan ini sudah diproses dan tidak bisa dibatalkan sendiri.";

/**
 * POST /pesanan/{order}/batalkan (customer). Ported from Shop\OrderController::cancel():
 * a customer may cancel only until payment arrives; the stock goes back to its batches.
 */
export async function POST(request: Request, { params }: RouteContext<"/pesanan/[order]/batalkan">) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const order = await findCustomerOrder(customer.id, (await params).order);

  if (!order) {
    return notFoundResponse(request, "Pesanan tidak ditemukan.");
  }

  // checked again on the locked row: a payment may have landed in the meantime
  const cancelled = isCancellableByCustomer(order) ? await cancelOrder(order, "dibatalkan", { allowed: isCancellableByCustomer }) : null;

  if (!cancelled) {
    return redirectTo(request, previousUrl(request, `/pesanan/${order.number}`), { error: NOT_CANCELLABLE });
  }

  return redirectTo(request, "/order-history", { success: `Pesanan #${order.number} dibatalkan.` });
}
