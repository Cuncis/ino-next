import PrivacyCenter from "@/views/shop/PrivacyCenter";
import { requireCustomer } from "@/server/shop/require-customer";
import { ShopPage } from "../shop-page";

/** PDP self-service: download my data, delete my account. */
export default async function Page() {
  await requireCustomer();

  return (
    <ShopPage>
      <PrivacyCenter />
    </ShopPage>
  );
}
