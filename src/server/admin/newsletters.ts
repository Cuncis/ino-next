import { and, count, eq, sql } from "drizzle-orm";
import { db, newsletters, subscribers } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { validate, type ValidationErrors } from "@/lib/validation";
import { DRAFT, SENDING, type Newsletter } from "@/server/newsletter/newsletter-mail";
import { SUBSCRIBED } from "@/server/newsletter/subscribers";
import { tiptapHtml, type TiptapNode } from "@/server/newsletter/tiptap-html";
import { orderBy, searchWords, type SortState } from "./list-query";

/**
 * Newsletter (NewsletterResource): campaigns written in the rich editor or pasted as
 * HTML, previewed, test-mailed and sent to every subscriber. Website content, so
 * Konten:Lihat to see and Konten:Ubah for everything else; one that left "draf" is locked.
 */
export const NEWSLETTER_SORTABLE = ["name", "sent_at"] as const;

export const isDraft = (newsletter: Pick<Newsletter, "status">) => newsletter.status === DRAFT;

export async function listNewsletters(query: { search?: string; sort: SortState; page: number; perPage: number }) {
  const where = searchWords(query.search, [sql`${newsletters.name}`, sql`${newsletters.subject}`]);
  const [{ total }] = await db.select({ total: count() }).from(newsletters).where(where);
  const rows = await db
    .select()
    .from(newsletters)
    .where(where)
    .orderBy(...orderBy(query.sort, { name: newsletters.name, sent_at: newsletters.sentAt }, { column: newsletters.id, direction: "desc" }, newsletters.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows };
}

export async function findNewsletter(id: number): Promise<Newsletter | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(newsletters).where(eq(newsletters.id, id)).limit(1);

  return row ?? null;
}

export async function subscribedTotal(): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(subscribers).where(eq(subscribers.status, SUBSCRIBED));

  return total;
}

export type NewsletterFormData = { name: string; subject: string; previewText: string | null; content: string | null; customHtml: string | null };

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const optional = (value: unknown): string | null => (text(value) === "" ? null : text(value));

/** The editor's document as stored HTML: tiptap-php's getHtml() of what the editor sent. */
function editorHtml(value: unknown): string | null {
  if (typeof value === "object" && value !== null && (value as TiptapNode).type === "doc") {
    return tiptapHtml(value as TiptapNode);
  }

  return typeof value === "string" ? value : null;
}

/** Whether the editor holds nothing but empty paragraphs: Filament's RichEditor counts that as blank for `required`. */
function blankDocument(value: unknown): boolean {
  const node = value as TiptapNode | null;

  if (!node || typeof node !== "object") {
    return text(value).trim() === "";
  }

  const hasContent = (current: TiptapNode): boolean =>
    (typeof current.text === "string" && current.text.trim() !== "") || (current.type !== undefined && !["doc", "paragraph", "text"].includes(current.type)) || (current.content ?? []).some(hasContent);

  return !hasContent(node);
}

/**
 * NewsletterForm's rules: the campaign's name and subject, the preview line, and the
 * editor's content unless custom HTML replaces it.
 */
export function validateNewsletterForm(body: Record<string, unknown>, locale: AdminLocale): { data: NewsletterFormData; errors: null } | { data: null; errors: ValidationErrors } {
  const t = (label: string) => lcfirst(translate(locale, label));
  const customHtml = optional(body.custom_html);
  const result = validate<Record<string, unknown>>(
    { ...body, content: blankDocument(body.content) ? null : "filled" },
    {
      name: ["required", "max:255"],
      subject: ["required", "max:255"],
      preview_text: ["nullable", "max:150"],
      ...(customHtml === null ? { content: ["required"] } : {}),
    },
    {},
    { name: t("Nama Kampanye (internal)"), subject: t("Subjek Email"), preview_text: t("Teks Pratinjau"), content: "content" },
    locale,
  );

  if (result.errors) {
    return { data: null, errors: result.errors };
  }

  return {
    data: { name: text(body.name), subject: text(body.subject), previewText: optional(body.preview_text), content: editorHtml(body.content), customHtml },
    errors: null,
  };
}

export async function createNewsletter(data: NewsletterFormData): Promise<Newsletter> {
  const now = new Date();
  const [newsletter] = await db
    .insert(newsletters)
    .values({ name: data.name, subject: data.subject, previewText: data.previewText, content: data.content, customHtml: data.customHtml, createdAt: now, updatedAt: now })
    .returning();

  return newsletter;
}

/** EditNewsletter: only a draft's fields change (a sent one's form is disabled, so nothing of it is saved). */
export async function updateNewsletter(newsletter: Newsletter, data: NewsletterFormData): Promise<void> {
  if (!isDraft(newsletter)) {
    return;
  }

  const next = { name: data.name, subject: data.subject, previewText: data.previewText, content: data.content, customHtml: data.customHtml };

  if (Object.entries(next).some(([key, value]) => newsletter[key as keyof Newsletter] !== value)) {
    await db
      .update(newsletters)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(newsletters.id, newsletter.id));
  }
}

export async function deleteNewsletter(id: number): Promise<void> {
  await db.delete(newsletters).where(eq(newsletters.id, id));
}

/**
 * "Kirim ke Subscriber": moving out of "draf" first is what stops a double click from
 * sending twice. Returns how many it goes to, or 0 (nothing changed) when nobody subscribes.
 */
export async function claimForSending(id: number): Promise<{ recipients: number; claimed: boolean }> {
  const recipients = await subscribedTotal();

  if (recipients === 0) {
    return { recipients, claimed: false };
  }

  const claimed = await db
    .update(newsletters)
    .set({ status: SENDING, recipientCount: recipients, updatedAt: new Date() })
    .where(and(eq(newsletters.id, id), eq(newsletters.status, DRAFT)))
    .returning({ id: newsletters.id });

  return { recipients, claimed: claimed.length > 0 };
}
