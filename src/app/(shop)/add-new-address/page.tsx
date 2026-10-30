import AddNewAddress from "@/views/shop/AddNewAddress";
import { provinceOptions } from "@/server/shop/addresses";
import { requireCustomer } from "@/server/shop/require-customer";
import { ShopPage } from "../shop-page";

export default async function Page() {
  await requireCustomer();

  return (
    <ShopPage>
      <AddNewAddress provinces={await provinceOptions()} />
    </ShopPage>
  );
}
