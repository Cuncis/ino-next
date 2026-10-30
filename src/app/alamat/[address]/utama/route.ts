import { previousUrl, redirectTo } from "@/lib/http";
import { findCustomerAddress, makeDefaultAddress } from "@/server/shop/addresses";
import { customerForAction } from "@/server/shop/customer-guard";

/** POST /alamat/{address}/utama (customer). Ported from Shop\AddressController::makeDefault(). */
export async function POST(request: Request, { params }: RouteContext<"/alamat/[address]/utama">) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const { address: id } = await params;
  const address = /^\d+$/.test(id) ? await findCustomerAddress(customer.id, Number(id)) : null;

  if (!address) {
    return Response.json({ message: "Alamat tidak ditemukan." }, { status: 404 });
  }

  await makeDefaultAddress(customer.id, address.id);

  return redirectTo(request, previousUrl(request, "/my-address"), { success: "Alamat utama diperbarui." });
}
