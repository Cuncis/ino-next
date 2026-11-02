import { cookies } from "next/headers";
import { flashForNextPage } from "@/lib/flash";
import { csrfMismatchResponse, isSameOrigin, redirectTo } from "@/lib/http";
import { checkStaffSession, STAFF_COOKIE, type Staff } from "./staff-auth";
import type { AdminLocale } from "@/lib/admin-i18n";

/**
 * Laravel's `admin` middleware (EnsureAdminIsAuthenticated) for a Route Handler: the
 * signed-in staff member, or the response that sends them to sign in. Every admin action
 * checks this itself; pages are checked in src/proxy.ts.
 */
export async function staffForAction(
  request: Request,
): Promise<{ staff: Staff; locale: AdminLocale; response?: never } | { staff?: never; locale?: never; response: Response }> {
  // a GET changes nothing, so only the requests that do need to come from this site
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return { response: csrfMismatchResponse() };
  }

  const store = await cookies();
  const check = await checkStaffSession(store.get(STAFF_COOKIE)?.value);

  if ("staff" in check) {
    return { staff: check.staff, locale: check.locale };
  }

  if (check.failure === "ended") {
    store.delete(STAFF_COOKIE);
    await flashForNextPage({ error: check.message });
  }

  return { response: await redirectTo(request, "/admin/masuk") };
}
