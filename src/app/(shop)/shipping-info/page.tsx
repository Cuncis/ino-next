import ShippingInfo from "@/views/shop/ShippingInfo";
import { pageDocumentForStorefront } from "@/server/shop/content/documents";

export default async function Page() {
  return <ShippingInfo document={await pageDocumentForStorefront("shipping")} />;
}
