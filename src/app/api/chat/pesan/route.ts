import { jsonBody } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { addMessage, chatNotFound as notFound, conversationByToken, FROM_VISITOR, presentMessages } from "@/server/chat";

/** POST /api/chat/pesan (throttle: 15 a minute per IP): another message from the visitor; it reopens a closed chat. */
export async function POST(request: Request) {
  const limited = await throttle("chat-send", 15, 1);

  if (limited) {
    return limited;
  }

  const { data, errors } = validate<{ message: string }>(await jsonBody(request), { message: ["required", "string", "max:1000"] }, {}, { message: "pesan" });

  // Laravel validated first, then looked the conversation up
  if (errors) {
    return validationErrorResponse(errors);
  }

  const token = request.headers.get("x-chat-token") ?? "";
  const conversation = await conversationByToken(token);

  if (!conversation) {
    return notFound(token);
  }

  const message = await addMessage(conversation, FROM_VISITOR, data.message);

  return Response.json({ message: presentMessages([message])[0] }, { status: 201 });
}
