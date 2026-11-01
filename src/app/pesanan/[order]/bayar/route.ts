import { externalRedirect, previousUrl, redirectTo } from "@/lib/http";
import { createPaymentForOrder } from "@/server/payments/doku-payment";
import { notFoundResponse } from "@/server/shop/cart-lookups";
import { customerForAction } from "@/server/shop/customer-guard";
import { findCustomerOrder } from "@/server/shop/orders";

/**
 * POST /pesanan/{order}/bayar (customer). Ported from Shop\PaymentController::create():
 * opens a new DOKU session for an order still waiting for payment, when the first one
 * expired or DOKU was down when the order was placed.
 */
export async function POST(request: Request, { params }: RouteContext<"/pesanan/[order]/bayar">) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const order = await findCustomerOrder(customer.id, (await params).order);

  if (!order) {
    return notFoundResponse(request, "Pesanan tidak ditemukan.");
  }

  const back = previousUrl(request, `/pesanan/${order.number}`);

  if (order.paymentStatus !== "belum bayar" || order.status !== "menunggu pembayaran") {
    return redirectTo(request, back, { error: "Pesanan ini sudah tidak menunggu pembayaran." });
  }

  let checkoutUrl: string | null;

  try {
    checkoutUrl = (await createPaymentForOrder(order)).checkoutUrl;
  } catch (error) {
    console.error(error);

    return redirectTo(request, back, { error: "Gagal membuka halaman pembayaran. Coba lagi sebentar lagi." });
  }

  return externalRedirect(request, checkoutUrl ?? back);
}
