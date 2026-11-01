import { csrfMismatchResponse, isSameOrigin, jsonBody, previousUrl, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { sendStaffPasswordResetLink, STAFF_PASSWORD_STATUS } from "@/server/admin/staff-auth";

/** POST /admin/lupa-sandi (throttle:6,1). AdminAuthController::sendResetLink(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("admin-lupa-sandi", 6, 1);

  if (limited) {
    return limited;
  }

  const { data, errors } = validate<{ email: string }>(await jsonBody(request), { email: ["required", "email"] });

  if (errors) {
    return validationErrorResponse(errors);
  }

  const status = await sendStaffPasswordResetLink(data.email);

  if (status !== "sent") {
    return validationErrorResponse({ email: [STAFF_PASSWORD_STATUS[status]] });
  }

  return redirectTo(request, previousUrl(request, "/admin/lupa-sandi"), { success: "Tautan pemulihan telah dikirim ke email Anda." });
}
