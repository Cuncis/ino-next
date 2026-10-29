import { getSetting } from "@/lib/content-store";
import { normalizePhone } from "@/lib/phone";

/**
 * What the storefront chat window says before a visitor writes anything: a welcome
 * message and a short list of ready-made questions. Edited by staff from the Inbox;
 * stored as national settings rows. Ported from App\Support\ChatSettings.
 */
export const WELCOME_KEY = "chat.welcome_message";
export const QUESTIONS_KEY = "chat.quick_questions";
export const MAX_QUESTIONS = 6;

export const CHAT_QUESTION_TYPES = ["message", "track_order", "auto_reply", "whatsapp", "phone", "ask_product"] as const;

export const DEFAULT_WELCOME = "Halo! Ada yang bisa kami bantu? Tulis pertanyaan Anda di bawah, admin kami siap membantu.";

export type QuickQuestion = { question: string; url: string | null; type: string; answer: string | null; phone: string | null };

export async function welcomeMessage(): Promise<string> {
  const message = ((await getSetting(WELCOME_KEY)) ?? "").trim();

  return message !== "" ? message : DEFAULT_WELCOME;
}

/** Each question may carry a link or another action. Older rows stored plain strings. */
export async function quickQuestions(): Promise<QuickQuestion[]> {
  let decoded: unknown;

  try {
    decoded = JSON.parse((await getSetting(QUESTIONS_KEY)) ?? "[]");
  } catch {
    decoded = [];
  }

  const items = typeof decoded === "object" && decoded !== null ? Object.values(decoded) : [];

  return items.map(normalizeQuestion).filter((item): item is QuickQuestion => item !== null);
}

export function normalizeQuestion(item: unknown): QuickQuestion | null {
  const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null;
  const question = String(record ? (record.question ?? "") : (item ?? "")).trim();
  const url = record ? String(record.url ?? "").trim() : "";
  const type = record && (CHAT_QUESTION_TYPES as readonly unknown[]).includes(record.type) ? String(record.type) : "message";
  const answer = record ? String(record.answer ?? "").trim() : "";
  const phone = record ? normalizePhone(String(record.phone ?? "")) : "";
  const needsPhone = type === "whatsapp" || type === "phone";

  // A shortcut that needs a detail it has not got is dropped rather than shown broken
  if (question === "" || (type === "auto_reply" && answer === "") || (needsPhone && phone === "")) {
    return null;
  }

  return {
    question,
    url: type === "message" && url !== "" ? url : null,
    type,
    answer: type === "auto_reply" ? answer : null,
    phone: needsPhone ? phone : null,
  };
}

export async function chatSettingsForStorefront() {
  return { welcome: await welcomeMessage(), quickQuestions: await quickQuestions() };
}
