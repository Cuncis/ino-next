import { Suspense, type ReactNode } from "react";
import { Inter } from "next/font/google";
import "./admin.css";

/** Filament's panel font (it loaded Inter from fonts.bunny.net). */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

/**
 * Applies the theme saved in this browser before the first paint, as Filament's layout
 * does: light unless the staff member picked dark, or "system" and the device is dark.
 */
const THEME_SCRIPT = `try{const m=localStorage.getItem('filament:theme:mode')||'light';if(m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

/** The admin panel's root layout (Filament's `<html class="fi">` page shell). */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" dir="ltr" className={`fi ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="fi-body fi-panel-admin fi-body-has-navigation fi-body-has-topbar">
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
