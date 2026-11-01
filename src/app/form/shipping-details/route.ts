import { jsonBody, redirectTo } from "@/lib/http";
import { validate, validationErrorResponse } from "@/lib/validation";
import { findCustomerAddress } from "@/server/shop/addresses";
import { CartManager } from "@/server/shop/cart";
import { notFoundResponse } from "@/server/shop/cart-lookups";
import { customerForAction } from "@/server/shop/customer-guard";

/** POST /shipping-details (customer): deliver the cart to this address. Ported from Shop\AddressController::selectForCheckout(). */
export async function POST(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const result = validate<{ addressId: string | number }>(await jsonBody(request), { addressId: ["required", "integer"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const address = await findCustomerAddress(customer.id, Number(result.data.addressId));

  if (!address) {
    return notFoundResponse(request, "Alamat tidak ditemukan.");
  }

  await new CartManager(customer).setAddress(address);

  return redirectTo(request, "/checkout");
}
