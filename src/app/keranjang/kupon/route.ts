import { jsonBody, previousUrl, redirectTo } from "@/lib/http";
import { validate, validationErrorResponse, validationExceptionResponse } from "@/lib/validation";
import { CartManager } from "@/server/shop/cart";
import { customerForAction } from "@/server/shop/customer-guard";

/** POST /keranjang/kupon (customer): apply a promo code. Ported from Shop\CartController::applyCoupon(). */
export async function POST(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const result = validate<{ code: string }>(await jsonBody(request), { code: ["required", "string"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  try {
    await new CartManager(customer).applyCoupon(result.data.code);
  } catch (error) {
    return validationExceptionResponse(error);
  }

  return redirectTo(request, previousUrl(request), { success: "Kode promo berhasil dipakai." });
}

/**
 * DELETE /keranjang/kupon (customer): take the promo code off. Ported from
 * Shop\CartController::removeCoupon(). In the Laravel app this request never got here:
 * `DELETE keranjang/{product}` was registered first and took it as a product called "kupon".
 */
export async function DELETE(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  await new CartManager(customer).removeCoupon();

  return redirectTo(request, previousUrl(request));
}
