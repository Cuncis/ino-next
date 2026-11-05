import { translate } from "@/lib/admin-i18n";
import { can } from "@/lib/permissions";
import { validate, validationErrorResponse } from "@/lib/validation";
import { addMessage, FROM_ADMIN, OPEN } from "@/server/chat";
import { adminActionContext, toastJson } from "./action-response";
import { formBody } from "./form-body";
import { CLOSED, findConversation, markConversationRead, saveChatSettings, setConversationStatus, validateChatSettings } from "./inbox";

/**
 * The Inbox behind /admin/inbox/…: a reply, closing and reopening a conversation (all
 * Inbox:Balas), marking it read while it is open (Inbox:Lihat), and Pengaturan Chat.
 */
const notFound = () => Response.json({ message: "Not Found" }, { status: 404 });

/** POST /admin/inbox/{id}/{balas|tutup|buka|baca}. */
export async function conversationAction(request: Request, id: string, action: string): Promise<Response> {
  const { staff, locale, response } = await adminActionContext(request, (access) => can(access, action === "baca" ? "Inbox:Lihat" : "Inbox:Balas"));

  if (response) {
    return response;
  }

  const conversation = await findConversation(Number(id));

  if (!conversation) {
    return notFound();
  }

  switch (action) {
    case "balas": {
      const result = validate<{ reply: string }>((await formBody(request)).data, { reply: ["required", "string", "max:2000"] }, {}, { reply: translate(locale, "Balasan") }, locale);

      if (!result.data) {
        return validationErrorResponse(result.errors);
      }

      await addMessage(conversation, FROM_ADMIN, result.data.reply, staff.id);

      return toastJson(locale, { status: "success", title: "Balasan terkirim" });
    }
    case "tutup":
      if (conversation.status !== OPEN) {
        return Response.json({ message: "This action is unauthorized." }, { status: 403 });
      }

      await setConversationStatus(conversation, CLOSED);

      return Response.json({});
    case "buka":
      if (conversation.status !== CLOSED) {
        return Response.json({ message: "This action is unauthorized." }, { status: 403 });
      }

      await setConversationStatus(conversation, OPEN);

      return Response.json({});
    case "baca":
      return Response.json({ changed: await markConversationRead(conversation) });
    default:
      return notFound();
  }
}

/** POST /admin/inbox/pengaturan: "Pengaturan Chat" (Inbox:Balas). */
export async function chatSettingsAction(request: Request): Promise<Response> {
  const { locale, response } = await adminActionContext(request, (access) => can(access, "Inbox:Balas"));

  if (response) {
    return response;
  }

  const result = validateChatSettings((await formBody(request)).data, locale);

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  await saveChatSettings(result.welcome, result.questions);

  return toastJson(locale, { status: "success", title: "Pengaturan chat disimpan." });
}
