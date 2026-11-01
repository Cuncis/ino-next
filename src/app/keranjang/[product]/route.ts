import { csrfMismatchResponse, isSameOrigin, jsonBody, previousUrl, redirectTo } from "@/lib/http";
import { validate, validationErrorResponse, validationExceptionResponse } from "@/lib/validation";
import { CartManager } from "@/server/shop/cart";
import { activeProductBySku, notFoundResponse } from "@/server/shop/cart-lookups";

/** PATCH /keranjang/{product}: a line's new quantity (0 removes it). Ported from Shop\CartController::update(). */
export async function PATCH(request: Request, { params }: RouteContext<"/keranjang/[product]">) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const result = validate<{ quantity: string | number }>(await jsonBody(request), { quantity: ["required", "integer", "min:0"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const product = await activeProductBySku(decodeURIComponent((await params).product));

  if (!product) {
    return notFoundResponse(request, "Produk tidak ditemukan.");
  }

  try {
    await (await CartManager.current()).updateItem(product, Number(result.data.quantity));
  } catch (error) {
    return validationExceptionResponse(error);
  }

  return redirectTo(request, previousUrl(request));
}

/** DELETE /keranjang/{product}. Ported from Shop\CartController::destroy(). */
export async function DELETE(request: Request, { params }: RouteContext<"/keranjang/[product]">) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const product = await activeProductBySku(decodeURIComponent((await params).product));

  if (!product) {
    return notFoundResponse(request, "Produk tidak ditemukan.");
  }

  await (await CartManager.current()).removeItem(product);

  return redirectTo(request, previousUrl(request), { success: "Produk dihapus dari keranjang." });
}
