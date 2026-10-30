import { eq } from "drizzle-orm";
import { customers, db } from "@/db";
import { nextCode } from "@/lib/code-sequence";
import { csrfMismatchResponse, isSameOrigin, jsonBody, redirectTo } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { addError, prepareInput, uniqueMessage, validate, validationErrorResponse } from "@/lib/validation";
import { CONSENT_VERSION, hashPassword, loginCustomer, sendEmailVerification } from "@/server/shop/customer-auth";
import { PHONE_REGEX_MESSAGE, PHONE_RULES } from "@/server/shop/phone-rules";


/** POST /daftar (throttle:6,1). Ported from Shop\AuthController::register(). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("daftar", 6, 1);

  if (limited) {
    return limited;
  }

  const body = await jsonBody(request);
  const result = validate<{ name: string; phone: string; email: string; password: string }>(
    body,
    {
      name: ["required", "string", "max:255"],
      phone: PHONE_RULES,
      email: ["required", "email", "max:255"],
      password: ["required", "confirmed", "min:8"],
      // PDP (UU 27/2022) requires an explicit, affirmative action
      consent: ["accepted"],
    },
    { "phone.regex": PHONE_REGEX_MESSAGE, "consent.accepted": "Anda harus menyetujui Kebijakan Privasi untuk mendaftar." },
  );
  let errors = result.errors;
  const input = result.data;
  // Laravel runs `unique` whenever the field has a value, even if an earlier rule failed
  const raw = prepareInput(body) as Record<string, unknown>;

  for (const field of ["phone", "email"] as const) {
    const value = raw[field];

    if (typeof value === "string" && (await db.select({ id: customers.id }).from(customers).where(eq(customers[field], value)).limit(1)).length) {
      errors = addError(errors, field, uniqueMessage(field));
    }
  }

  if (errors || !input) {
    return validationErrorResponse(errors ?? {});
  }

  const now = new Date();
  const [customer] = await db
    .insert(customers)
    .values({
      code: await nextCode({ table: customers, column: customers.code, prefix: "CUS-" }),
      name: input.name,
      phone: input.phone,
      email: input.email,
      password: await hashPassword(input.password),
      status: "aktif",
      consentAt: now,
      consentVersion: CONSENT_VERSION,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await loginCustomer(customer);
  await sendEmailVerification(customer);

  return redirectTo(request, "/verify-phone");
}
