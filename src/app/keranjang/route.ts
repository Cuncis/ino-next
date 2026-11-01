import { csrfMismatchResponse, isSameOrigin, jsonBody, previousUrl, redirectTo } from "@/lib/http";
import { validate, validationErrorResponse, validationExceptionResponse } from "@/lib/validation";
import { CartBranchConflict, CartManager } from "@/server/shop/cart";
import { activeProductBySku, branchByCode, notFoundResponse } from "@/server/shop/cart-lookups";

/** POST /keranjang: add to cart, guests included. Ported from Shop\CartController::store(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const result = validate<{ productId: string; branchId: string; quantity: string | number | null; switchBranch: unknown }>(await jsonBody(request), {
    productId: ["required", "string"],
    branchId: ["required", "string"],
    quantity: ["nullable", "integer", "min:1"],
    switchBranch: ["nullable", "boolean"],
  });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const data = result.data;
  const product = await activeProductBySku(data.productId);

  if (!product) {
    return notFoundResponse(request, "Produk tidak ditemukan.");
  }

  const branch = await branchByCode(data.branchId);

  if (!branch) {
    return notFoundResponse(request, "Cabang tidak ditemukan.");
  }

  try {
    const switchBranch = [true, 1, "1"].includes(data.switchBranch as never);

    await (await CartManager.current()).addItem(product, branch, Number(data.quantity ?? 1), switchBranch);
  } catch (error) {
    if (error instanceof CartBranchConflict) {
      return validationErrorResponse({ branch: [`${error.message} Kosongkan keranjang dan pindah ke ${branch.name}?`] });
    }

    return validationExceptionResponse(error);
  }

  return redirectTo(request, previousUrl(request), { success: `${product.name} ditambahkan ke keranjang.` });
}
