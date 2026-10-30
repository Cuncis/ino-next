import { previousUrl, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { sendEmailVerification } from "@/server/shop/customer-auth";
import { customerForAction } from "@/server/shop/customer-guard";

/** POST /kirim-verifikasi-email (customer, throttle:6,1). Ported from Shop\AuthController::sendVerificationEmail(). */
export async function POST(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const limited = await throttle("kirim-verifikasi-email", 6, 1);

  if (limited) {
    return limited;
  }

  if (customer.emailVerifiedAt) {
    return redirectTo(request, previousUrl(request));
  }

  await sendEmailVerification(customer);

  return redirectTo(request, previousUrl(request), { success: "Tautan verifikasi baru telah dikirim." });
}
