import { Suspense } from "react";
import DesktopHintProvider from "@/components/shop/DesktopHintProvider";
import { InertiaProvider } from "@/lib/inertia";
import { guessDesktop } from "@/server/shop/device";
import { sharedProps } from "@/server/shop/shared-props";
import { fontVariables } from "../fonts";
import "../globals.css";

/**
 * The storefront's root layout, like the Laravel app's app.blade.php for `Shop/*`
 * pages: `shop-zoom` on <html> scales the storefront up on wide monitors.
 * The admin gets its own root layout.
 */
export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`shop-zoom ${fontVariables}`}>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>
          <WithSharedProps>{children}</WithSharedProps>
        </Suspense>
      </body>
    </html>
  );
}

async function WithSharedProps({ children }: { children: React.ReactNode }) {
  const [shared, isDesktop] = await Promise.all([sharedProps(), guessDesktop()]);

  return (
    <InertiaProvider shared={shared}>
      <DesktopHintProvider isDesktop={isDesktop}>{children}</DesktopHintProvider>
    </InertiaProvider>
  );
}
