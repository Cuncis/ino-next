import { redirect } from "next/navigation";
import Checkout from "@/views/shop/Checkout";
import { CartManager, exceedsPurchaseLimit } from "@/server/shop/cart";
import { checkoutPageProps } from "@/server/shop/checkout";
import { currentCustomer } from "@/server/shop/customer-auth";
import { ShopPage } from "../shop-page";

/**
 * Ported from Shop\CheckoutController::show(). Open to guests: one page and one submit for
 * everyone. src/proxy.ts already sent an empty or over-limit cart back to /cart with a
 * message; this checks again in case the cart changed in between.
 */
export default async function Page() {
  const customer = await currentCustomer();
  const data = await new CartManager(customer).current();

  if (!data.branch || data.lines.length === 0 || exceedsPurchaseLimit(data.lines)) {
    redirect("/cart");
  }

  const props = await checkoutPageProps({ ...data, branch: data.branch }, !customer);

  return (
    <ShopPage>
      <Checkout {...props} />
    </ShopPage>
  );
}
