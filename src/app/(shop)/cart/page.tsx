import { redirect } from "next/navigation";
import Cart from "@/views/shop/Cart";
import { CartManager } from "@/server/shop/cart";
import { presentCart } from "@/server/shop/cart-presenter";
import { ShopPage } from "../shop-page";

/**
 * Ported from Shop\CartController::index(). src/proxy.ts already sent an empty cart to
 * /cart-empty before anything rendered; this checks again in case it emptied in between.
 */
export default async function Page() {
  const data = await (await CartManager.current()).current();

  if (data.lines.length === 0) {
    redirect("/cart-empty");
  }

  return (
    <ShopPage>
      <Cart cart={await presentCart(data)} />
    </ShopPage>
  );
}
