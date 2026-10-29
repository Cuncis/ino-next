import Faq from "@/views/shop/Faq";
import { faqForStorefront } from "@/server/shop/content/faq";

export default async function Page() {
  return <Faq faqs={await faqForStorefront()} />;
}
