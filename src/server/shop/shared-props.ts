import type { SharedProps } from "@/lib/inertia";
import { catalogForStorefront } from "./catalog";
import { chatSettingsForStorefront } from "./content/chat-settings";
import { footerForStorefront } from "./content/footer";

/**
 * What every storefront page receives, like Laravel's HandleInertiaRequests::share().
 */
export async function sharedProps(): Promise<SharedProps> {
  const [catalog, chatSettings, siteFooter] = await Promise.all([catalogForStorefront(), chatSettingsForStorefront(), footerForStorefront()]);

  return {
    auth: { user: null },
    // Signed-in customer: wired up with customer auth (step 3)
    shopUser: null,
    flash: { success: null, error: null },
    // Laravel sent the same nulls for empty columns (blurb, oldPrice, ...) that the old
    // TypeScript types leave out, so the views already handle them
    catalog: catalog as unknown as Catalog,
    chatSettings,
    siteFooter,
    // Badge on the "Pesanan" tab: wired up with the cart (step 4)
    cartCount: 0,
  };
}
