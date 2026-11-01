import OrderHistory from "@/views/shop/OrderHistory";
import { requireCustomer } from "@/server/shop/require-customer";
import { customerOrderHistory } from "@/server/shop/orders";
import { ShopPage } from "../shop-page";

/** The customer's orders, newest first. Ported from Shop\OrderController::index(). */
export default async function Page() {
  const customer = await requireCustomer();

  return (
    <ShopPage>
      <OrderHistory orders={await customerOrderHistory(customer.id)} />
    </ShopPage>
  );
}
