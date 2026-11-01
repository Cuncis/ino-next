import { asc, eq } from "drizzle-orm";
import { db, orderItems } from "@/db";
import OrderSuccessful from "@/views/shop/OrderSuccessful";
import { currentCustomer } from "@/server/shop/customer-auth";
import { findCustomerOrder, orderItemImages } from "@/server/shop/orders";
import { ShopPage } from "../shop-page";

/**
 * The "thank you" page after checkout, ported from Shop\OrderController::success(). The
 * order recap only appears for the signed-in customer who placed it; anyone else just
 * sees the number.
 */
export default async function Page({ searchParams }: PageProps<"/order-successful">) {
  const nomor = (await searchParams).nomor;
  const number = typeof nomor === "string" ? nomor : null;
  const customer = await currentCustomer();

  return (
    <ShopPage>
      <OrderSuccessful orderNumber={number} order={number && customer ? await recap(customer.id, number) : null} />
    </ShopPage>
  );
}

async function recap(customerId: number, number: string) {
  const order = await findCustomerOrder(customerId, number);

  if (!order) {
    return null;
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));
  const images = await orderItemImages(items);

  return {
    items: items.map((item) => ({
      sku: item.sku ?? "",
      name: item.productName,
      image: item.productId === null ? null : (images.get(item.productId) ?? null),
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    subtotal: order.subtotal,
    discount: order.discountTotal,
    shipping: order.shippingTotal,
    total: order.grandTotal,
    fulfilment: order.fulfilment,
  };
}
