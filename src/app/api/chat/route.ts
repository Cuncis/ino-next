import { jsonBody } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { validate, validationErrorResponse } from "@/lib/validation";
import { chatNotFound as notFound, conversationByToken, conversationMessages, markRepliesSeen, newChatToken, presentMessages, startConversation, unseenReplyCount } from "@/server/chat";
import { subscribeEmail } from "@/server/newsletter/subscribers";

/**
 * The storefront chat (routes/api.php, `api/chat`), ported from Api\ChatController.
 * No session or CSRF: the visitor's conversation token is the key.
 */

/** POST /api/chat (throttle: 5 an hour per IP): starts a conversation with a first message. */
export async function POST(request: Request) {
  const limited = await throttle("chat-start", 5, 60);

  if (limited) {
    return limited;
  }

  const body = await jsonBody(request);
  const { data, errors } = validate<{ name: string; email: string; message: string; website: string | null; subscribe: unknown }>(
    body,
    {
      name: ["required", "string", "max:120"],
      email: ["required", "email:rfc", "max:190"],
      message: ["required", "string", "max:1000"],
      website: ["nullable", "string", "max:0"],
      subscribe: ["nullable", "boolean"],
    },
    {},
    { name: "nama", email: "email", message: "pesan" },
  );

  if (errors) {
    return validationErrorResponse(errors);
  }

  // a filled honeypot is a bot: answer as if it worked and store nothing
  if (data.website) {
    return Response.json({ token: newChatToken(), messages: [] }, { status: 201 });
  }

  const conversation = await startConversation(data.name, data.email, data.message);

  if ([true, 1, "1", "true", "on", "yes"].includes(data.subscribe as never)) {
    await subscribeEmail(conversation.email);
  }

  return Response.json({ token: conversation.token, messages: presentMessages(await conversationMessages(conversation)) }, { status: 201 });
}

/**
 * GET /api/chat?after=…&open=1 (throttle: 60 a minute per IP): messages since `after`.
 * With `open=1` the visitor is looking at the chat, so the admin's replies count as seen
 * (and won't be emailed); the closed launcher's background check leaves them unseen.
 */
export async function GET(request: Request) {
  const limited = await throttle("chat-poll", 60, 1);

  if (limited) {
    return limited;
  }

  const token = request.headers.get("x-chat-token") ?? "";
  const conversation = await conversationByToken(token);

  if (!conversation) {
    return notFound(token);
  }

  const query = new URL(request.url).searchParams;
  const after = Math.max(Number.parseInt(query.get("after") ?? "0", 10) || 0, 0);
  const messages = await conversationMessages(conversation, after);

  if (["1", "true", "on", "yes"].includes(query.get("open") ?? "")) {
    await markRepliesSeen(conversation);
  }

  return Response.json({ messages: presentMessages(messages), unread: await unseenReplyCount(conversation) });
}
