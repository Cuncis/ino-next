import { csrfMismatchResponse, isSameOrigin, jsonBody, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { resetStaffPassword, STAFF_PASSWORD_STATUS } from "@/server/admin/staff-auth";

/** POST /admin/atur-ulang-sandi (throttle:6,1). AdminAuthController::resetPassword(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("admin-atur-ulang-sandi", 6, 1);

  if (limited) {
    return limited;
  }

  // Password::defaults(): at least 8 characters
  const { data, errors } = validate<{ token: string; email: string; password: string }>(await jsonBody(request), {
    token: ["required"],
    email: ["required", "email"],
    password: ["required", "confirmed", "min:8"],
  });

  if (errors) {
    return validationErrorResponse(errors);
  }

  const status = await resetStaffPassword(data.email, data.token, data.password);

  if (status !== "reset") {
    return validationErrorResponse({ email: [STAFF_PASSWORD_STATUS[status]] });
  }

  return redirectTo(request, "/admin/masuk", { success: "Kata sandi berhasil diubah. Silakan masuk." });
}
