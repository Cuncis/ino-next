import { jsonBody } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { trackOrderForChat } from "@/server/chat";

/** POST /api/chat/lacak-pesanan (throttle: 8 a minute per IP): an order's status by its number and the account's email. */
export async function POST(request: Request) {
  const limited = await throttle("chat-track", 8, 1);

  if (limited) {
    return limited;
  }

  const { data, errors } = validate<{ order_number: string; email: string }>(
    await jsonBody(request),
    { order_number: ["required", "string", "max:60"], email: ["required", "email:rfc", "max:190"] },
    {},
    { order_number: "nomor pesanan", email: "alamat email" },
  );

  if (errors) {
    return validationErrorResponse(errors);
  }

  const order = await trackOrderForChat(data.order_number, data.email);

  if (!order) {
    return Response.json({ message: "Pesanan tidak ditemukan. Periksa nomor pesanan dan alamat email Anda." }, { status: 404 });
  }

  return Response.json({ order });
}
