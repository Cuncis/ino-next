import { Suspense, type ReactNode } from "react";
import "./admin.css";

/**
 * Applies the theme saved in this browser before the first paint, as Filament's layout
 * does: light unless the staff member picked dark, or "system" and the device is dark.
 */
const THEME_SCRIPT = `try{const m=localStorage.getItem('filament:theme:mode')||'light';if(m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

/** The admin panel's root layout (Filament's `<html class="fi">` page shell). */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" dir="ltr" className="fi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* BunnyFontProvider: the same Inter files Filament loads (Google's build is spaced wider) */}
        <link rel="preconnect" href="https://fonts.bunny.net" />
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700&display=swap" rel="stylesheet" />
      </head>
      <body className="fi-body fi-panel-admin fi-body-has-navigation fi-body-has-topbar">
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
