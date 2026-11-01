import { and, asc, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { chatConversations, chatMessages, customers, db, orders, shipments } from "@/db";
import { FULFILMENTS, ORDER_STATUSES, toLabel } from "@/lib/admin-options";
import { appUrl } from "@/lib/app-url";
import { indonesianDate, iso8601 } from "@/lib/dates";
import { sendNotification } from "@/lib/mail";
import { dispatch, transaction } from "@/lib/queue";
import { randomString } from "@/lib/random";
import { activeStaffWithPermission, notifyStaff } from "@/server/notifications/staff";
import { orderSteps } from "@/server/shop/orders";

/**
 * The storefront chat, ported from Api\ChatController, the ChatConversation and
 * ChatMessage models and App\Observers\ChatMessageObserver. A visitor has no account:
 * the name and email they gave and a 40-character token kept in their browser tie them
 * to their conversation.
 */
export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const FROM_VISITOR = "pengunjung";
export const FROM_ADMIN = "admin";
export const OPEN = "terbuka";

/** How long an admin reply may sit unseen before it is emailed (CHAT_EMAIL_DELAY_MINUTES, default 2). */
function emailDelayMinutes(): number {
  const minutes = Number.parseInt(process.env.CHAT_EMAIL_DELAY_MINUTES ?? "2", 10);

  return Number.isNaN(minutes) ? 2 : minutes;
}

export const newChatToken = () => randomString(40);

export function presentMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({ id: message.id, sender: message.sender, body: message.body, createdAt: iso8601(message.createdAt) }));
}

/**
 * No conversation for the token sent, answered as Laravel did in production: an empty
 * message for a token of the wrong length (abort(404)), firstOrFail()'s for an unknown one.
 */
export function chatNotFound(token: string): Response {
  return Response.json({ message: token.length === 40 ? "No query results for model [App\\Models\\ChatConversation]." : "" }, { status: 404 });
}

export async function conversationByToken(token: string): Promise<ChatConversation | null> {
  if (token.length !== 40) {
    return null;
  }

  const [conversation] = await db.select().from(chatConversations).where(eq(chatConversations.token, token)).limit(1);

  return conversation ?? null;
}

export async function startConversation(name: string, email: string, body: string): Promise<ChatConversation> {
  const now = new Date();
  const [conversation] = await db
    .insert(chatConversations)
    .values({ token: newChatToken(), name: name.trim(), email: email.trim().toLowerCase(), lastMessageAt: now, createdAt: now, updatedAt: now })
    .returning();

  await addMessage(conversation, FROM_VISITOR, body);

  return conversation;
}

export async function conversationMessages(conversation: ChatConversation, after = 0): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.chatConversationId, conversation.id), gt(chatMessages.id, after)))
    .orderBy(asc(chatMessages.id));
}

const unseenAdminReplies = (conversation: ChatConversation) =>
  and(eq(chatMessages.chatConversationId, conversation.id), eq(chatMessages.sender, FROM_ADMIN), isNull(chatMessages.visitorSeenAt));

/** The visitor has the chat window open: the admin's replies count as seen, and won't be emailed. */
export async function markRepliesSeen(conversation: ChatConversation): Promise<void> {
  await db.update(chatMessages).set({ visitorSeenAt: new Date(), updatedAt: new Date() }).where(unseenAdminReplies(conversation));
}

export async function unseenReplyCount(conversation: ChatConversation): Promise<number> {
  const [{ unseen }] = await db.select({ unseen: count() }).from(chatMessages).where(unseenAdminReplies(conversation));

  return unseen;
}

/**
 * A new message, and what ChatMessageObserver::created() did with it: a visitor's
 * message reopens the chat and, if staff weren't already waiting to reply, tells them;
 * an admin reply reopens it, clears the unread count and emails the visitor a little
 * later unless they see it in the chat first.
 */
export async function addMessage(conversation: ChatConversation, sender: typeof FROM_VISITOR | typeof FROM_ADMIN, body: string, userId: number | null = null): Promise<ChatMessage> {
  return transaction(db, async (tx) => {
    const now = new Date();
    const [message] = await tx
      .insert(chatMessages)
      .values({ chatConversationId: conversation.id, sender, userId, body: body.trim(), createdAt: now, updatedAt: now })
      .returning();

    if (sender === FROM_ADMIN) {
      await tx
        .update(chatConversations)
        .set({ status: OPEN, adminUnreadCount: 0, lastMessageAt: message.createdAt, updatedAt: now })
        .where(eq(chatConversations.id, conversation.id));
      await dispatch("chat-replied", { messageId: message.id, email: conversation.email, name: conversation.name }, { delay: emailDelayMinutes() * 60_000 });

      return message;
    }

    // counted in SQL, so two messages at once can't both think they started the wait
    const [updated] = await tx
      .update(chatConversations)
      .set({ status: OPEN, adminUnreadCount: sql`${chatConversations.adminUnreadCount} + 1`, lastMessageAt: message.createdAt, updatedAt: now })
      .where(eq(chatConversations.id, conversation.id))
      .returning();

    if (updated.adminUnreadCount === 1) {
      await notifyStaff(await activeStaffWithPermission("Inbox:Lihat", tx), "NewChatMessage", conversation.id, message.id);
    }

    return message;
  });
}

/**
 * The queued reply email (App\Notifications\ChatReplied), sent CHAT_EMAIL_DELAY_MINUTES
 * after a reply. Skipped when the visitor already saw that reply, or it already went out
 * with its neighbours; otherwise every reply still unseen and unsent goes in one email.
 */
export async function sendChatReplyEmail(payload: { messageId: number; email: string; name: string }): Promise<void> {
  const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, payload.messageId)).limit(1);

  if (!message || message.visitorSeenAt !== null || message.emailedAt !== null) {
    return;
  }

  const [conversation] = await db.select().from(chatConversations).where(eq(chatConversations.id, message.chatConversationId)).limit(1);

  if (!conversation) {
    return;
  }

  const pending = await db
    .select()
    .from(chatMessages)
    .where(and(unseenAdminReplies(conversation), isNull(chatMessages.emailedAt)))
    .orderBy(asc(chatMessages.id));

  if (pending.length) {
    await db
      .update(chatMessages)
      .set({ emailedAt: new Date(), updatedAt: new Date() })
      .where(
        inArray(
          chatMessages.id,
          pending.map((reply) => reply.id),
        ),
      );
  }

  await sendNotification(
    { email: payload.email, name: payload.name },
    {
      subject: "Balasan dari Apotek Inofarma",
      greeting: `Halo ${conversation.name},`,
      introLines: ["Admin Apotek Inofarma membalas pesan Anda:", ...pending.map((reply) => `> ${reply.body.replaceAll("\n", "\n> ")}`)],
      // url('/') has no trailing slash
      action: { text: "Lanjutkan chat", url: `${appUrl("/").replace(/\/$/, "")}?chat=${conversation.token}` },
      outroLines: ["Anda bisa membalas langsung dari tautan di atas. Tautan ini khusus untuk Anda, jangan dibagikan."],
    },
  );
}

/**
 * The chat's "Lacak Pesanan" shortcut: an order's status for whoever knows both its
 * number and the account's email. A wrong number and a wrong email get the same answer.
 */
export async function trackOrderForChat(orderNumber: string, email: string) {
  const [row] = await db
    .select({ order: orders })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(and(eq(orders.number, orderNumber.trim()), eq(customers.email, email.trim().toLowerCase()), isNull(orders.deletedAt), isNull(customers.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  const { order } = row;
  const [shipment] = await db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(asc(shipments.id)).limit(1);
  const steps = orderSteps(order);
  const current = steps.find((step) => step.state === "current") ?? steps.findLast((step) => step.state === "done");
  const payment: Record<string, string> = { lunas: "Sudah dibayar", "belum bayar": "Belum dibayar", gagal: "Pembayaran gagal", refund: "Dana dikembalikan" };

  return {
    number: order.number,
    status: toLabel(ORDER_STATUSES, order.status),
    step: current?.label ?? null,
    payment: Object.hasOwn(payment, order.paymentStatus) ? payment[order.paymentStatus] : null,
    fulfilment: toLabel(FULFILMENTS, order.fulfilment),
    date: indonesianDate(order.createdAt),
    total: order.grandTotal,
    courier: shipment ? `${shipment.courierName ?? ""} ${shipment.courierServiceName ?? ""}`.trim() : null,
    waybill: shipment?.waybillId ?? null,
  };
}
