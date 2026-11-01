import { notFound } from "next/navigation";
import OrderDetail from "@/views/shop/OrderDetail";
import { latestPendingPayment, reconcilePayment } from "@/server/payments/doku-payment";
import { requireCustomer } from "@/server/shop/require-customer";
import { findCustomerOrder, presentCustomerOrder } from "@/server/shop/orders";
import { ShopPage } from "../../shop-page";

/**
 * Items, total, and the Bayar/Batalkan actions; where DOKU sends the shopper back after
 * paying. Ported from Shop\OrderController::show(). An unknown number already answered
 * 404 in src/proxy.ts.
 */
export default async function Page({ params }: PageProps<"/pesanan/[order]">) {
  const customer = await requireCustomer();
  const number = (await params).order;
  let order = await findCustomerOrder(customer.id, number);

  if (!order) {
    notFound();
  }

  // The shopper is often back before DOKU's webhook (in development it never arrives:
  // DOKU can't reach localhost), so DOKU is asked, and the answer goes through the same
  // path as the webhook.
  if (order.paymentStatus === "belum bayar" && order.status === "menunggu pembayaran") {
    const pending = await latestPendingPayment(order.id);

    if (pending) {
      try {
        await reconcilePayment(pending);
        order = (await findCustomerOrder(customer.id, number)) ?? order;
      } catch (error) {
        console.error(error);
      }
    }
  }

  return (
    <ShopPage>
      <OrderDetail order={await presentCustomerOrder(order)} />
    </ShopPage>
  );
}
