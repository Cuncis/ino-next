import { cookies } from "next/headers";
import { clientIp, csrfMismatchResponse, isSameOrigin, jsonBody, redirectTo } from "@/lib/http";
import { rateLimiter } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { attemptCustomerLogin, loginCustomer } from "@/server/shop/customer-auth";
import { INTENDED_COOKIE } from "@/server/shop/intended";

/** POST /signin (rewritten here by src/proxy.ts). Ported from Shop\AuthController::login(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const body = await jsonBody(request);
  const result = validate<{ email: string; password: string }>(body, { email: ["required", "string"], password: ["required", "string"] });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const { email, password } = result.data;
  const throttleKey = `${email.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")}|${await clientIp()}`;

  if (await rateLimiter.tooManyAttempts(throttleKey, 5)) {
    const seconds = await rateLimiter.availableIn(throttleKey);

    return validationErrorResponse({ email: [`Terlalu banyak percobaan. Coba lagi dalam ${seconds} detik.`] });
  }

  const customer = await attemptCustomerLogin(email, password);

  if (!customer) {
    await rateLimiter.hit(throttleKey);

    return validationErrorResponse({ email: ["Email/No. Telepon atau kata sandi salah."] });
  }

  await rateLimiter.clear(throttleKey);

  if (customer.status !== "aktif") {
    return validationErrorResponse({ email: ["Akun Anda tidak aktif."] });
  }

  await loginCustomer(customer, [true, 1, "1", "true", "on", "yes"].includes(body.remember as never));
  // Merging a guest's session cart into the account comes with the cart (step 4)

  const store = await cookies();
  const intended = store.get(INTENDED_COOKIE)?.value;

  store.delete(INTENDED_COOKIE);

  return redirectTo(request, intended?.startsWith("/") ? intended : "/");
}
