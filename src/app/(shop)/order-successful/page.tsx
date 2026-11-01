import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, orderItems, orders, productImages, products } from "@/db";
import { displayUrl } from "@/lib/storage";
import OrderSuccessful from "@/views/shop/OrderSuccessful";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/server/shop/catalog";
import { currentCustomer } from "@/server/shop/customer-auth";
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
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customerId), eq(orders.number, number), isNull(orders.deletedAt)))
    .limit(1);

  if (!order) {
    return null;
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));
  const ids = items.flatMap((item) => (item.productId === null ? [] : [item.productId]));
  // a line whose product was deleted since shows no photo (Eloquent hid the product)
  const live = ids.length
    ? await db
        .select({ id: products.id })
        .from(products)
        .where(and(inArray(products.id, ids), isNull(products.deletedAt)))
    : [];
  const productIds = live.map((product) => product.id);
  const images = productIds.length
    ? await db
        .select({ productId: productImages.productId, path: productImages.path })
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.position), asc(productImages.id))
    : [];

  return {
    items: items.map((item) => ({
      sku: item.sku ?? "",
      name: item.productName,
      image: item.productId === null || !productIds.includes(item.productId) ? null : displayUrl(images.find((image) => image.productId === item.productId)?.path ?? PRODUCT_PLACEHOLDER_IMAGE),
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
