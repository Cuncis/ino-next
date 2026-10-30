import ShippingInfo from "@/views/shop/ShippingInfo";
import { pageDocumentForStorefront } from "@/server/shop/content/documents";
import { ShopPage } from "../shop-page";

export default async function Page() {
  return (
    <ShopPage>
      <ShippingInfo document={await pageDocumentForStorefront("shipping")} />
    </ShopPage>
  );
}
