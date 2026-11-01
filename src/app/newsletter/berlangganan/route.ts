import { csrfMismatchResponse, isSameOrigin, jsonBody, previousUrl, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { subscribeEmail } from "@/server/newsletter/subscribers";

/** POST /newsletter/berlangganan (throttle:6,1): the footer's sign-up. Ported from Shop\NewsletterSubscribeController. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("newsletter", 6, 1);

  if (limited) {
    return limited;
  }

  const { data, errors } = validate<{ email: string }>(
    await jsonBody(request),
    { email: ["required", "email:rfc", "max:255"] },
    { "email.required": "Masukkan alamat email Anda.", "email.email": "Alamat email tidak valid." },
  );

  if (errors) {
    return validationErrorResponse(errors);
  }

  await subscribeEmail(data.email);

  return redirectTo(request, previousUrl(request, "/"), { success: "Terima kasih! Anda sudah berlangganan info sehat dan hemat dari Inofarma." });
}
