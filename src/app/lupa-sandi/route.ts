import { csrfMismatchResponse, isSameOrigin, jsonBody, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { PASSWORD_STATUS, sendPasswordResetLink } from "@/server/shop/customer-auth";

/** POST /lupa-sandi (throttle:6,1). Ported from Shop\AuthController::sendResetLink(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("lupa-sandi", 6, 1);

  if (limited) {
    return limited;
  }

  const result = validate<{ email: string }>(await jsonBody(request), { email: ["required", "email"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const status = await sendPasswordResetLink(result.data.email);

  if (status !== "sent") {
    return validationErrorResponse({ email: [PASSWORD_STATUS[status]] });
  }

  return redirectTo(request, "/email-sent");
}
