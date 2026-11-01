import { cookies } from "next/headers";
import { csrfMismatchResponse, externalRedirect, isSameOrigin, jsonBody, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { completeTwoFactorChallenge, findStaff, PENDING_2FA_COOKIE, pendingTwoFactorUserId } from "@/server/admin/staff-auth";

/** POST /admin/dua-faktor (throttle:10,1). TwoFactorChallengeController::store(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("admin-2fa-route", 10, 1);

  if (limited) {
    return limited;
  }

  const userId = await pendingTwoFactorUserId((await cookies()).get(PENDING_2FA_COOKIE)?.value);

  if (!userId) {
    return redirectTo(request, "/admin/masuk");
  }

  const staff = await findStaff(userId);

  if (!staff) {
    return Response.json({ message: "No query results for model [App\\Models\\User]." }, { status: 404 });
  }

  const { data, errors } = validate<{ code: string }>(await jsonBody(request), { code: ["required", "string"] });

  if (errors) {
    return validationErrorResponse(errors);
  }

  const result = await completeTwoFactorChallenge(staff, data.code);

  return result === true ? externalRedirect(request, "/admin") : validationErrorResponse({ code: [result] });
}
