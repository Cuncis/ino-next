import { previousUrl, redirectTo } from "@/lib/http";
import { rateLimiter, throttle } from "@/lib/rate-limit";
import { issuePhoneOtp } from "@/server/shop/customer-auth";
import { customerForAction } from "@/server/shop/customer-guard";
import { logOtp, otpFlashMessage, otpThrottleKey } from "@/server/shop/phone-otp";

/** POST /otp-code/kirim-ulang (customer, throttle:3,10). Ported from Shop\AuthController::resendPhoneOtp(). */
export async function POST(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const limited = await throttle("otp-code-kirim-ulang", 3, 10);

  if (limited) {
    return limited;
  }

  const code = await issuePhoneOtp(customer.id);

  await rateLimiter.clear(otpThrottleKey(customer.id));
  logOtp(customer, code);

  return redirectTo(request, previousUrl(request, "/otp-code"), { success: otpFlashMessage(code, true) });
}
