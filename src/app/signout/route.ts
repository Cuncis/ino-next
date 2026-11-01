import { redirectTo } from "@/lib/http";
import { forgetGuestCart } from "@/server/shop/cart";
import { logoutCustomer } from "@/server/shop/customer-auth";
import { customerForAction } from "@/server/shop/customer-guard";

/** Ported from Shop\AuthController::logout(). */
export async function POST(request: Request) {
  const { response } = await customerForAction(request);

  if (response) {
    return response;
  }

  await logoutCustomer();
  // Laravel invalidated the whole session, the guest cart in it included
  await forgetGuestCart();

  return redirectTo(request, "/signin");
}
