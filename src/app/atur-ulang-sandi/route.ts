import { csrfMismatchResponse, isSameOrigin, jsonBody, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { PASSWORD_STATUS, resetPassword } from "@/server/shop/customer-auth";

/** POST /atur-ulang-sandi (throttle:6,1). Ported from Shop\AuthController::resetPassword(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("atur-ulang-sandi", 6, 1);

  if (limited) {
    return limited;
  }

  const result = validate<{ token: string; email: string; password: string }>(await jsonBody(request), {
    token: ["required"],
    email: ["required", "email"],
    password: ["required", "confirmed", "min:8"],
  });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const status = await resetPassword(result.data.email, String(result.data.token), result.data.password);

  if (status !== "reset") {
    return validationErrorResponse({ email: [PASSWORD_STATUS[status]] });
  }

  return redirectTo(request, "/signin", { success: "Kata sandi berhasil diubah. Silakan masuk." });
}
