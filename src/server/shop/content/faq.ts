import { paragraphs, readContent } from "@/lib/content-store";
import defaults from "./defaults/faq.json";

/**
 * The storefront FAQ: questions and answers edited under Konten Website > FAQ. Until
 * someone saves, the page shows the defaults. Ported from App\Support\FaqContent.
 */
export const FAQ_CONTENT_KEY = "content.faq";

export const MAX_FAQ_QUESTIONS = 40;

type SavedFaqItem = { question: string; answer: string };

export async function faqItems(): Promise<SavedFaqItem[]> {
  const saved = await readContent(FAQ_CONTENT_KEY);

  return "items" in saved && typeof saved.items === "object" && saved.items !== null ? cleanFaq(saved.items) : defaults;
}

/** Answers are split into paragraphs here, so the page only has to loop. */
export async function faqForStorefront(): Promise<FaqItem[]> {
  return (await faqItems()).map((item) => ({ question: item.question, paragraphs: paragraphs(item.answer) }));
}

export function cleanFaq(items: unknown): SavedFaqItem[] {
  return Object.values(items as Record<string, unknown>)
    .map((item) => {
      const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};

      return { question: String(record.question ?? "").trim(), answer: String(record.answer ?? "").trim() };
    })
    .filter((item) => item.question !== "" && item.answer !== "");
}
