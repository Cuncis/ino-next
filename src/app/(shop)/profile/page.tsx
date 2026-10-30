import Profile from "@/views/shop/Profile";
import { requireCustomer } from "@/server/shop/require-customer";
import { ShopPage } from "../shop-page";

export default async function Page() {
  await requireCustomer();

  return (
    <ShopPage>
      <Profile />
    </ShopPage>
  );
}
