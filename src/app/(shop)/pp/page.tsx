import PrivacyPolicy from "@/views/shop/PrivacyPolicy";
import { privacyPolicyForStorefront } from "@/server/shop/content/documents";
import { ShopPage } from "../shop-page";

/** Kebijakan Privasi: fixed text, not edited in the admin. */
export default function Page() {
  return (
    <ShopPage>
      <PrivacyPolicy document={privacyPolicyForStorefront()} />
    </ShopPage>
  );
}
