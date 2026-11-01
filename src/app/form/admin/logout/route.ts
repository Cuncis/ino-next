import { csrfMismatchResponse, isSameOrigin, redirectResponse } from "@/lib/http";
import { logoutStaff } from "@/server/admin/staff-auth";

/**
 * POST /admin/logout: the user menu's "Keluar" (Filament's LogoutController). Signs out
 * without an audit entry and goes to /admin, which then asks to sign in.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  await logoutStaff();

  return redirectResponse("/admin", 303);
}
