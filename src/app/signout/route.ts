import { redirectTo } from "@/lib/http";
import { logoutCustomer } from "@/server/shop/customer-auth";
import { customerForAction } from "@/server/shop/customer-guard";

/** Ported from Shop\AuthController::logout(). */
export async function POST(request: Request) {
  const { response } = await customerForAction(request);

  if (response) {
    return response;
  }

  await logoutCustomer();

  return redirectTo(request, "/signin");
}
