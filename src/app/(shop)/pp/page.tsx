import PrivacyPolicy from "@/views/shop/PrivacyPolicy";
import { privacyPolicyForStorefront } from "@/server/shop/content/documents";

/** Kebijakan Privasi: fixed text, not edited in the admin. */
export default function Page() {
  return <PrivacyPolicy document={privacyPolicyForStorefront()} />;
}
