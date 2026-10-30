import { Suspense } from "react";
import DesktopHintProvider from "@/components/shop/DesktopHintProvider";
import { guessDesktop } from "@/server/shop/device";
import { fontVariables } from "../fonts";
import "../globals.css";

/**
 * Storefront navigations wait for the next page's data, like Inertia visits did (the
 * current page stays until the next one is ready), rather than showing placeholders.
 */
export const instant = false;

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
          <WithDesktopHint>{children}</WithDesktopHint>
        </Suspense>
      </body>
    </html>
  );
}

/** The phone-or-desktop guess for the first render (see useIsDesktop). */
async function WithDesktopHint({ children }: { children: React.ReactNode }) {
  return <DesktopHintProvider isDesktop={await guessDesktop()}>{children}</DesktopHintProvider>;
}
