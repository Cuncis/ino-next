import type { ReactNode } from "react";
import { headers } from "next/headers";
import { FLASH_HEADER, parseFlash } from "@/lib/flash";
import { InertiaProvider } from "@/lib/inertia";

/** The client form helper for a sign-in screen, with the flash handed on by src/proxy.ts. */
export async function AdminAuthPage({ children }: { children: ReactNode }) {
  const flash = parseFlash((await headers()).get(FLASH_HEADER));

  return <InertiaProvider shared={{ auth: { user: null }, shopUser: null, flash }}>{children}</InertiaProvider>;
}
