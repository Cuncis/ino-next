import { eq } from "drizzle-orm";
import { customers, db } from "@/db";
import { jsonBody, redirectTo } from "@/lib/http";
import { rateLimiter, throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { MAX_OTP_ATTEMPTS, verifyPhoneOtp } from "@/server/shop/customer-auth";
import { customerForAction } from "@/server/shop/customer-guard";
import { otpThrottleKey } from "@/server/shop/phone-otp";

/** POST /otp-code (customer, throttle:10,1). Ported from Shop\AuthController::verifyPhoneOtp(). */
export async function POST(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const limited = await throttle("otp-code", 10, 1);

  if (limited) {
    return limited;
  }

  const result = validate<{ code: string }>(await jsonBody(request), { code: ["required", "string"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const key = otpThrottleKey(customer.id);

  // five wrong guesses use the code up, so a 6-digit code cannot be walked through before it expires
  if (await rateLimiter.tooManyAttempts(key, MAX_OTP_ATTEMPTS)) {
    await db.update(customers).set({ phoneOtpCode: null, phoneOtpExpiresAt: null, updatedAt: new Date() }).where(eq(customers.id, customer.id));

    return validationErrorResponse({ code: ["Terlalu banyak percobaan. Kirim ulang kode OTP."] });
  }

  if (!(await verifyPhoneOtp(customer, result.data.code))) {
    await rateLimiter.hit(key, 600);

    return validationErrorResponse({ code: ["Kode OTP salah atau sudah kedaluwarsa."] });
  }

  await rateLimiter.clear(key);

  return redirectTo(request, "/account-created");
}
