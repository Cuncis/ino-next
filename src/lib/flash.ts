import { cookies } from "next/headers";

/**
 * Laravel's `->with('success', ...)`: a message for the next page only. Form requests
 * answer with JSON and carry it in the body (see `@/lib/inertia`); a plain navigation,
 * such as a link opened from an email, gets it through this cookie, which
 * `src/proxy.ts` hands to the next page and then deletes.
 */
export const FLASH_COOKIE = "inofarma_flash";

/** Request header the proxy passes the message on in. */
export const FLASH_HEADER = "x-inofarma-flash";

export type Flash = { success?: string; error?: string };

export async function flashForNextPage(flash: Flash): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, JSON.stringify(flash), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 });
}

export function parseFlash(value: string | null | undefined): { success: string | null; error: string | null } {
  try {
    const flash = JSON.parse(value ?? "{}") as Flash;

    return { success: flash.success ?? null, error: flash.error ?? null };
  } catch {
    return { success: null, error: null };
  }
}
