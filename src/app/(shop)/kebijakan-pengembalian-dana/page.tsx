import RefundPolicy from "@/views/shop/RefundPolicy";
import { pageDocumentForStorefront } from "@/server/shop/content/documents";
import { ShopPage } from "../shop-page";

export default async function Page() {
  return (
    <ShopPage>
      <RefundPolicy document={await pageDocumentForStorefront("refund")} />
    </ShopPage>
  );
}
