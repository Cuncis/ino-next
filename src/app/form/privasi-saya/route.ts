import { eq } from "drizzle-orm";
import { carts, customerAddresses, customers, db } from "@/db";
import { jsonBody, redirectTo } from "@/lib/http";
import { verifyLaravelPassword } from "@/lib/password";
import { validate, validationErrorResponse } from "@/lib/validation";
import { forgetGuestCart } from "@/server/shop/cart";
import { logoutCustomer } from "@/server/shop/customer-auth";
import { customerForAction } from "@/server/shop/customer-guard";

/**
 * DELETE /privasi-saya (customer): deletes the account after the password is confirmed.
 * Order history stays (an order is a financial record), but the identifying fields are
 * scrambled, addresses and cart are removed, and the email is freed for reuse.
 * Ported from Shop\PrivacyController::destroyAccount().
 */
export async function DELETE(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const result = validate<{ password: string }>(await jsonBody(request), { password: ["required"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  if (!(await verifyLaravelPassword(result.data.password, customer.password))) {
    return validationErrorResponse({ password: ["Kata sandi salah."] });
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, customer.id));
    await tx.delete(carts).where(eq(carts.customerId, customer.id));
    await tx
      .update(customers)
      .set({ name: "Pelanggan Dihapus", email: `dihapus-${customer.id}-${customer.email}`, phone: null, updatedAt: now, deletedAt: now })
      .where(eq(customers.id, customer.id));
  });

  await logoutCustomer();
  // Laravel invalidated the whole session, the guest cart in it included
  await forgetGuestCart();

  return redirectTo(request, "/", { success: "Akun Anda telah dihapus." });
}
