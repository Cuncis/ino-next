import { and, asc, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { chatConversations, chatMessages, db, settings, users } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { addError, validate, type ValidationErrors } from "@/lib/validation";
import { OPEN, type ChatConversation } from "@/server/chat";
import { CHAT_QUESTION_TYPES, MAX_QUESTIONS, normalizeQuestion, QUESTIONS_KEY, WELCOME_KEY } from "@/server/shop/content/chat-settings";
import { orderBy, searchWords, type SortState } from "./list-query";

/**
 * Inbox (ChatConversationResource): every chat a storefront visitor started, newest
 * activity first; one conversation's thread with a reply box, close and reopen; and the
 * chat window's welcome text and quick questions ("Pengaturan Chat").
 */
export const CLOSED = "ditutup";

export const INBOX_SORTABLE = ["admin_unread_count", "last_message_at"] as const;

/** Conversations with visitor messages the admin hasn't read (`needsReply()`). */
export async function conversationsNeedingReply(): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(chatConversations).where(gt(chatConversations.adminUnreadCount, 0));

  return total;
}

export async function listConversations(query: { search?: string; needsReply?: boolean; status?: string; sort: SortState; page: number; perPage: number }) {
  const where = and(
    query.needsReply ? gt(chatConversations.adminUnreadCount, 0) : undefined,
    query.status ? eq(chatConversations.status, query.status) : undefined,
    searchWords(query.search, [sql`${chatConversations.name}`, sql`${chatConversations.email}`]),
  );
  const [{ total }] = await db.select({ total: count() }).from(chatConversations).where(where);
  const rows = await db
    .select()
    .from(chatConversations)
    .where(where)
    .orderBy(
      ...orderBy(
        query.sort,
        { admin_unread_count: chatConversations.adminUnreadCount, last_message_at: chatConversations.lastMessageAt },
        { column: chatConversations.lastMessageAt, direction: "desc" },
        chatConversations.id,
      ),
    )
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);
  const latest = await latestMessages(rows.map((row) => row.id));

  return { total, rows: rows.map((row) => ({ ...row, latestBody: latest.get(row.id) ?? null })) };
}

/** `latestMessage` (latestOfMany): each conversation's message with the highest id. */
async function latestMessages(ids: number[]) {
  const found = new Map<number, string>();

  if (!ids.length) {
    return found;
  }

  const rows = await db
    .selectDistinctOn([chatMessages.chatConversationId], { conversationId: chatMessages.chatConversationId, body: chatMessages.body })
    .from(chatMessages)
    .where(inArray(chatMessages.chatConversationId, ids))
    .orderBy(chatMessages.chatConversationId, desc(chatMessages.id));

  for (const row of rows) {
    found.set(row.conversationId, row.body);
  }

  return found;
}

export async function findConversation(id: number): Promise<ChatConversation | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(chatConversations).where(eq(chatConversations.id, id)).limit(1);

  return row ?? null;
}

/** The thread, oldest first, with each admin reply's author. */
export async function conversationThread(id: number) {
  return db
    .select({ message: chatMessages, author: users.name })
    .from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.userId))
    .where(eq(chatMessages.chatConversationId, id))
    .orderBy(asc(chatMessages.id));
}

/** Opening the conversation counts as reading it: the "belum dibaca" count goes back to zero. */
export async function markConversationRead(conversation: ChatConversation): Promise<boolean> {
  if (conversation.adminUnreadCount <= 0) {
    return false;
  }

  await db.update(chatConversations).set({ adminUnreadCount: 0, updatedAt: new Date() }).where(eq(chatConversations.id, conversation.id));

  return true;
}

export async function setConversationStatus(conversation: ChatConversation, status: typeof OPEN | typeof CLOSED): Promise<void> {
  if (conversation.status !== status) {
    await db.update(chatConversations).set({ status, updatedAt: new Date() }).where(eq(chatConversations.id, conversation.id));
  }
}

/* ---------------- Pengaturan Chat ---------------- */

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const TEL = "/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/";

export type QuestionInput = { type: string; question: string; url: string; answer: string; phone: string };

/**
 * The settings form's rules, field by field as Filament validates a repeater: each
 * item's question, then the link, answer or phone its type shows. Errors are keyed
 * `quick_questions.{index}.{field}`.
 */
export function validateChatSettings(body: Record<string, unknown>, locale: AdminLocale): { errors: ValidationErrors } | { errors: null; welcome: string; questions: QuestionInput[] } {
  const t = (label: string) => lcfirst(translate(locale, label));
  const items = (Array.isArray(body.quick_questions) ? body.quick_questions : []).map((item): QuestionInput => {
    const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

    return { type: text(record.type) || "message", question: text(record.question), url: text(record.url), answer: text(record.answer), phone: text(record.phone) };
  });
  let errors = validate<Record<string, unknown>>(body, { welcome_message: ["required", "max:500"] }, {}, { welcome_message: t("Pesan sambutan") }, locale).errors;

  if (items.length > MAX_QUESTIONS) {
    errors = addError(errors, "quick_questions", translate(locale, "Kolom :attribute tidak boleh memiliki lebih dari :max item.", { attribute: t("Pertanyaan cepat"), max: MAX_QUESTIONS }));
  }

  items.forEach((item, index) => {
    const needsPhone = item.type === "whatsapp" || item.type === "phone";
    const rules: Record<string, string[]> = {
      type: [`in:${CHAT_QUESTION_TYPES.join(",")}`],
      question: ["required", "max:120"],
      ...(item.type === "message" ? { url: ["nullable", "max:255"] } : {}),
      ...(item.type === "auto_reply" ? { answer: ["required", "max:600"] } : {}),
      ...(needsPhone ? { phone: ["required", "max:20", `regex:${TEL}`] } : {}),
    };
    const result = validate<Record<string, unknown>>(
      { ...item, url: item.url === "" ? null : item.url },
      rules,
      {},
      { type: t("Jenis tombol"), question: t("Pertanyaan"), url: t("Tautan (opsional)"), answer: t("Jawaban"), phone: t("Nomor telepon / WhatsApp") },
      locale,
    );

    for (const [field, messages] of Object.entries(result.errors ?? {})) {
      errors = addError(errors, `quick_questions.${index}.${field}`, messages[0]);
    }

    if (item.type === "message" && item.url !== "" && !result.errors?.url && !/^(\/(?!\/)|https?:\/\/)/i.test(item.url)) {
      errors = addError(errors, `quick_questions.${index}.url`, translate(locale, "Tautan harus diawali / atau https://."));
    }
  });

  return errors ? { errors } : { errors: null, welcome: text(body.welcome_message), questions: items };
}

/** PHP's json_encode(\u2026, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES). */
const phpJson = (value: unknown) => JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/** ChatSettings::save(): the welcome trimmed, at most six usable questions, each as one national settings row. */
export async function saveChatSettings(welcome: string, questions: QuestionInput[]): Promise<void> {
  // ChatSettings::normalize() trims and drops what isn't usable; the phone it keeps is the normalised one
  const usable = questions
    .map(normalizeQuestion)
    .filter((item) => item !== null)
    .slice(0, MAX_QUESTIONS);

  await upsertSetting(WELCOME_KEY, welcome.trim(), "string");
  await upsertSetting(QUESTIONS_KEY, phpJson(usable), "json");
}

/** Setting::updateOrCreate(): written (and its updated_at touched) only when it changed. */
async function upsertSetting(key: string, value: string, type: string): Promise<void> {
  const now = new Date();
  const [current] = await db
    .select()
    .from(settings)
    .where(and(isNull(settings.branchId), eq(settings.key, key)))
    .limit(1);

  if (!current) {
    await db.insert(settings).values({ branchId: null, key, value, type, createdAt: now, updatedAt: now });
  } else if (current.value !== value || current.type !== type) {
    await db.update(settings).set({ value, type, updatedAt: now }).where(eq(settings.id, current.id));
  }
}
