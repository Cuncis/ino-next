import { cookies } from "next/headers";
import { clientIp, csrfMismatchResponse, externalRedirect, isSameOrigin, jsonBody, redirectTo } from "@/lib/http";
import { validate, validationErrorResponse } from "@/lib/validation";
import { ADMIN_INTENDED_COOKIE, attemptStaffCredentials, hasEnabledTwoFactor, loginStaff, startTwoFactorChallenge } from "@/server/admin/staff-auth";

/**
 * POST /admin/masuk (AdminAuthController::login()). A password alone signs in only an
 * account without 2FA; otherwise the 2FA step comes next and nobody is signed in yet.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const { data, errors } = validate<{ email: string; password: string }>(await jsonBody(request), {
    email: ["required", "string", "email"],
    password: ["required", "string"],
  });

  if (errors) {
    return validationErrorResponse(errors);
  }

  const staff = await attemptStaffCredentials(data.email, data.password, await clientIp());

  if (typeof staff === "string") {
    return validationErrorResponse({ email: [staff] });
  }

  if (hasEnabledTwoFactor(staff)) {
    await startTwoFactorChallenge(staff);

    return redirectTo(request, "/admin/dua-faktor");
  }

  await loginStaff(staff);

  // a full page visit: the panel is a different app shell (Inertia::location())
  const store = await cookies();
  const intended = store.get(ADMIN_INTENDED_COOKIE)?.value;

  store.delete(ADMIN_INTENDED_COOKIE);

  return externalRedirect(request, intended?.startsWith("/admin") ? intended : "/admin");
}
