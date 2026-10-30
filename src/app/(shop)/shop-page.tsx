import type { ReactNode } from "react";
import { InertiaProvider } from "@/lib/inertia";
import { sharedProps } from "@/server/shop/shared-props";

/**
 * Wraps every storefront page with the shared props (signed-in customer, cart count,
 * catalogue, flash...). Loaded per page, not in the layout, because Next.js keeps a
 * layout across navigations: like an Inertia visit, each page visit must bring fresh ones.
 */
export async function ShopPage({ children }: { children: ReactNode }) {
  return <InertiaProvider shared={await sharedProps()}>{children}</InertiaProvider>;
}
