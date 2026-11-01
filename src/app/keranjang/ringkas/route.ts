import { CartManager } from "@/server/shop/cart";
import { presentCart } from "@/server/shop/cart-presenter";

/**
 * GET /keranjang/ringkas: the cart as JSON for the header's mini-cart, refreshed without
 * a page visit; the same shape the Cart page renders. Ported from Shop\CartController::preview().
 */
export async function GET() {
  return Response.json(await presentCart(await (await CartManager.current()).current()));
}
