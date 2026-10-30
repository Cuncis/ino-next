import { headers } from "next/headers";
import { FLASH_HEADER, parseFlash } from "@/lib/flash";
import type { SharedProps } from "@/lib/inertia";
import { catalogForStorefront } from "./catalog";
import { chatSettingsForStorefront } from "./content/chat-settings";
import { footerForStorefront } from "./content/footer";
import { currentCustomer } from "./customer-auth";

/**
 * What every storefront page receives, like Laravel's HandleInertiaRequests::share().
 */
export async function sharedProps(): Promise<SharedProps> {
  const [catalog, chatSettings, siteFooter, customer, requestHeaders] = await Promise.all([
    catalogForStorefront(),
    chatSettingsForStorefront(),
    footerForStorefront(),
    currentCustomer(),
    headers(),
  ]);

  return {
    auth: { user: null },
    shopUser: customer ? { name: customer.name, email: customer.email, phone: customer.phone } : null,
    // a message for this page, handed on by src/proxy.ts (see @/lib/flash)
    flash: parseFlash(requestHeaders.get(FLASH_HEADER)),
    // Laravel sent the same nulls for empty columns (blurb, oldPrice, ...) that the old
    // TypeScript types leave out, so the views already handle them
    catalog: catalog as unknown as Catalog,
    chatSettings,
    siteFooter,
    // Badge on the "Pesanan" tab: wired up with the cart (step 4)
    cartCount: 0,
  };
}
