import { Suspense, type ReactNode } from "react";
import { fontVariables } from "../fonts";
import "../globals.css";

/**
 * The staff sign-in screens (masuk, lupa sandi, atur ulang sandi, dua faktor): Inertia
 * pages in the Laravel app, styled by its app stylesheet like the storefront but without
 * the storefront's `shop-zoom`. The panel itself has its own root layout.
 */
export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={fontVariables}>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
