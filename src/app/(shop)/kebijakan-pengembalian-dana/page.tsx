import RefundPolicy from "@/views/shop/RefundPolicy";
import { pageDocumentForStorefront } from "@/server/shop/content/documents";

export default async function Page() {
  return <RefundPolicy document={await pageDocumentForStorefront("refund")} />;
}
