import ShippingDetails from "@/views/shop/ShippingDetails";
import { customerAddressList } from "@/server/shop/addresses";
import { requireCustomer } from "@/server/shop/require-customer";
import { ShopPage } from "../shop-page";

/** The address picker that "Ubah" on the checkout page links to. Ported from Shop\AddressController::forCheckout(). */
export default async function Page() {
  const customer = await requireCustomer();

  return (
    <ShopPage>
      <ShippingDetails addresses={await customerAddressList(customer.id)} />
    </ShopPage>
  );
}
