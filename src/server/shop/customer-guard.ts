import { flashForNextPage } from "@/lib/flash";
import { csrfMismatchResponse, isSameOrigin, wantsJson } from "@/lib/http";
import { currentCustomer, logoutCustomer, type Customer } from "./customer-auth";

/**
 * Laravel's `customer` middleware (EnsureCustomerIsAuthenticated) for a Route Handler:
 * the signed-in, active customer, or the response that sends the visitor to sign in.
 * Pages are guarded in src/proxy.ts and check again with `currentCustomer()`.
 */
export const INACTIVE_MESSAGE = "Akun Anda tidak aktif.";

export async function customerForAction(request: Request): Promise<{ customer: Customer; response?: never } | { customer?: never; response: Response }> {
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return { response: csrfMismatchResponse() };
  }

  const customer = await currentCustomer();

  if (customer && customer.status === "aktif") {
    return { customer };
  }

  const flash = customer ? { error: INACTIVE_MESSAGE } : undefined;

  if (customer) {
    await logoutCustomer();
  }

  if (wantsJson(request)) {
    return { response: Response.json({ redirect: "/signin", flash }) };
  }

  if (flash) {
    await flashForNextPage(flash);
  }

  return { response: Response.redirect(new URL("/signin", request.url), 303) };
}
