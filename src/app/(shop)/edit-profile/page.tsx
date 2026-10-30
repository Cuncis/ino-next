import EditProfile from "@/views/shop/EditProfile";
import { customerAddressList } from "@/server/shop/addresses";
import { requireCustomer } from "@/server/shop/require-customer";
import { ShopPage } from "../shop-page";

/** "Ubah Profil" shows the saved addresses inline, with a link out to manage them. */
export default async function Page() {
  const customer = await requireCustomer();

  return (
    <ShopPage>
      <EditProfile addresses={await customerAddressList(customer.id)} />
    </ShopPage>
  );
}
