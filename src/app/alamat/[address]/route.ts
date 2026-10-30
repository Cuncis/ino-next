import { desc, eq } from "drizzle-orm";
import { customerAddresses, db } from "@/db";
import { previousUrl, redirectTo, wantsJson } from "@/lib/http";
import { findCustomerAddress } from "@/server/shop/addresses";
import { customerForAction } from "@/server/shop/customer-guard";

/** DELETE /alamat/{address} (customer). Ported from Shop\AddressController::destroy(). */
export async function DELETE(request: Request, { params }: RouteContext<"/alamat/[address]">) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const { address: id } = await params;
  const address = /^\d+$/.test(id) ? await findCustomerAddress(customer.id, Number(id)) : null;

  if (!address) {
    return notFound(request);
  }

  await db.delete(customerAddresses).where(eq(customerAddresses.id, address.id));

  if (address.isDefault) {
    const [newest] = await db
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customer.id))
      .orderBy(desc(customerAddresses.id))
      .limit(1);

    if (newest) {
      await db.update(customerAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(customerAddresses.id, newest.id));
    }
  }

  return redirectTo(request, previousUrl(request, "/my-address"), { success: "Alamat dihapus." });
}

function notFound(request: Request): Response {
  return wantsJson(request)
    ? Response.json({ message: "Alamat tidak ditemukan." }, { status: 404 })
    : new Response("Alamat tidak ditemukan.", { status: 404 });
}
