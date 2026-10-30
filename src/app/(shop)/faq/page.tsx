import Faq from "@/views/shop/Faq";
import { faqForStorefront } from "@/server/shop/content/faq";
import { ShopPage } from "../shop-page";

export default async function Page() {
  return (
    <ShopPage>
      <Faq faqs={await faqForStorefront()} />
    </ShopPage>
  );
}
