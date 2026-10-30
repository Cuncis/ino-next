import { and, eq, ne } from "drizzle-orm";
import { customers, db } from "@/db";
import { jsonBody, redirectTo } from "@/lib/http";
import { rateLimiter, throttle } from "@/lib/rate-limit";
import { addError, prepareInput, validate, validationErrorResponse } from "@/lib/validation";
import { issuePhoneOtp } from "@/server/shop/customer-auth";
import { customerForAction } from "@/server/shop/customer-guard";
import { logOtp, otpFlashMessage, otpThrottleKey } from "@/server/shop/phone-otp";
import { PHONE_REGEX_MESSAGE, PHONE_RULES } from "@/server/shop/phone-rules";

/** POST /verify-phone (customer, throttle:3,10). Ported from Shop\AuthController::sendPhoneOtp(). */
export async function POST(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const limited = await throttle("verify-phone", 3, 10);

  if (limited) {
    return limited;
  }

  const body = await jsonBody(request);
  const result = validate<{ phone: string }>(body, { phone: PHONE_RULES }, { "phone.regex": PHONE_REGEX_MESSAGE });
  let errors = result.errors;
  const phone = (prepareInput(body) as Record<string, unknown>).phone;

  if (
    typeof phone === "string" &&
    (await db.select({ id: customers.id }).from(customers).where(and(eq(customers.phone, phone), ne(customers.id, customer.id))).limit(1)).length
  ) {
    errors = addError(errors, "phone", "Nomor telepon ini sudah dipakai akun lain.");
  }

  if (errors || !result.data) {
    return validationErrorResponse(errors ?? {});
  }

  // a new number is not verified just because the old one was
  await db
    .update(customers)
    .set({ phone: result.data.phone, phoneVerifiedAt: customer.phone === result.data.phone ? customer.phoneVerifiedAt : null, updatedAt: new Date() })
    .where(eq(customers.id, customer.id));

  const code = await issuePhoneOtp(customer.id);

  await rateLimiter.clear(otpThrottleKey(customer.id));
  logOtp({ phone: result.data.phone }, code);

  return redirectTo(request, "/otp-code", { success: otpFlashMessage(code) });
}
