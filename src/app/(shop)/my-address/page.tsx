import MyAddress from "@/views/shop/MyAddress";
import { customerAddressList } from "@/server/shop/addresses";
import { requireCustomer } from "@/server/shop/require-customer";
import { ShopPage } from "../shop-page";

export default async function Page() {
  const customer = await requireCustomer();

  return (
    <ShopPage>
      <MyAddress addresses={await customerAddressList(customer.id)} />
    </ShopPage>
  );
}
