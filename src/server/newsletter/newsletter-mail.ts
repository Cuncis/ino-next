import { and, asc, count, eq, gt } from "drizzle-orm";
import { db, newsletterDeliveries, newsletters, subscribers } from "@/db";
import { appUrl } from "@/lib/app-url";
import { sendMail } from "@/lib/mail";
import { SUBSCRIBED, type Subscriber } from "./subscribers";

/**
 * Newsletters by email, ported from App\Jobs\SendNewsletter, App\Mail\NewsletterMail,
 * App\Support\Newsletters\NewsletterRenderer and resources/views/emails/newsletter.blade.php.
 */
export type Newsletter = typeof newsletters.$inferSelect;

export const DRAFT = "draf";
export const SENDING = "mengirim";
export const SENT = "terkirim";
export const FAILED = "gagal";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** The editor's "Tombol" block (App\Filament\RichContent\ButtonBlock::toHtml()). */
export function buttonHtml(config: { label?: unknown; url?: unknown }): string {
  const label = escapeHtml(String(config.label ?? ""));
  const url = escapeHtml(String(config.url ?? "#"));

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
    <tr>
        <td align="center" style="background-color:#24CE30;border-radius:2px;">
            <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#24CE30;border-radius:2px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${label}</a>
        </td>
    </tr>
</table>`;
}

/**
 * Editor content as the email shows it. Filament's renderer leaves the editor's HTML as
 * it is except for its own pieces: a custom block becomes its HTML (only the button
 * exists), and an uploaded image loads from the public disk. Then every site-relative
 * link and image is made absolute: an email has no "current site".
 */
export function renderEditorContent(content: string | null): string {
  const html = (content ?? "")
    .replace(/<div\b[^>]*\bdata-type="customBlock"[^>]*>[\s\S]*?<\/div>/gi, (block) => {
      const id = /\bdata-id="([^"]*)"/i.exec(block)?.[1];
      const configText = /\bdata-config="([^"]*)"/i.exec(block)?.[1];

      if (id !== "button") {
        return "";
      }

      try {
        return buttonHtml(JSON.parse(decodeAttribute(configText ?? "{}")) as Record<string, unknown>);
      } catch {
        return buttonHtml({});
      }
    })
    .replace(/<img\b[^>]*\bdata-id="([^"]+)"[^>]*>/gi, (image, id: string) => {
      const src = appUrl(`/storage/${decodeAttribute(id)}`);

      return /\bsrc="[^"]*"/i.test(image) ? image.replace(/\bsrc="[^"]*"/i, `src="${escapeHtml(src)}"`) : image.replace(/<img\b/i, `<img src="${escapeHtml(src)}"`);
    });

  return absoluteUrls(html);
}

/**
 * Pasted HTML is trusted as written (only an administrator can paste it), except that
 * scripts and inline handlers are removed, and a full document's <style> blocks move to
 * the email's <head>, where mail apps read them.
 */
export function renderCustomHtml(source: string): { body: string; styles: string } {
  let html = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/href\s*=\s*(["'])\s*javascript:[^"']*\1/gi, 'href="#"');
  let styles = "";

  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (style) => {
    styles += `${style}\n`;

    return "";
  });

  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html);

  html = body ? body[1] : html.replace(/<\/?(?:!doctype|html|head|body|meta|title)\b[^>]*>/gi, "");

  return { body: absoluteUrls(html.trim()), styles };
}

export function absoluteUrls(html: string): string {
  return html.replace(/\b(src|href)="(\/[^"/][^"]*)"/gi, (_, attribute: string, path: string) => `${attribute}="${appUrl(path)}"`);
}

export function renderNewsletter(newsletter: Pick<Newsletter, "content" | "customHtml">): { body: string; styles: string; isCustom: boolean } {
  if ((newsletter.customHtml ?? "").trim() !== "") {
    return { ...renderCustomHtml(newsletter.customHtml!), isCustom: true };
  }

  return { body: renderEditorContent(newsletter.content), styles: "", isCustom: false };
}

export function unsubscribeUrl(subscriber: Pick<Subscriber, "unsubscribeToken">): string {
  return appUrl(`/newsletter/berhenti/${subscriber.unsubscribeToken}`);
}

const EDITOR_STYLES = `        <style>
            .nl p { margin:0 0 16px; line-height:1.6; }
            .nl h2 { margin:24px 0 12px; font-size:22px; line-height:1.3; color:#0900AA; }
            .nl h3 { margin:20px 0 10px; font-size:18px; line-height:1.3; color:#0900AA; }
            .nl a { color:#005bd3; }
            .nl table a { color:#ffffff !important; }
            .nl img { max-width:100%; height:auto; }
            .nl ul, .nl ol { margin:0 0 16px; padding-left:24px; line-height:1.6; }
        </style>
`;

/** The email itself: one newsletter to one person, with their own unsubscribe link. */
export function newsletterEmail(newsletter: Newsletter, subscriber: Subscriber, isTest = false) {
  const { body, styles, isCustom } = renderNewsletter(newsletter);
  const unsubscribe = unsubscribeUrl(subscriber);
  const subject = `${isTest ? "[TEST] " : ""}${newsletter.subject}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(newsletter.subject)}</title>
${isCustom ? "" : EDITOR_STYLES}    ${styles}
</head>
<body style="margin:0;padding:0;background:#F3F5F6;">
${
  newsletter.previewText
    ? `    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F3F5F6;font-size:1px;line-height:1px;">${escapeHtml(newsletter.previewText)}</div>\n`
    : ""
}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F3F5F6;">
        <tr>
            <td align="center" style="padding:24px 12px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;">
                    <tr>
                        <td style="background:#0900AA;padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">
                            Apotek Inofarma
                        </td>
                    </tr>
${
  isTest
    ? `                    <tr>
                        <td style="background:#FFF8E1;padding:10px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#B35400;">
                            Ini adalah email uji coba. Belum dikirim ke pelanggan.
                        </td>
                    </tr>
`
    : ""
}
                    <tr>
                        <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#232323;">
                            <div class="${isCustom ? "nl-custom" : "nl"}">${body}</div>
                        </td>
                    </tr>

                    <tr>
                        <td style="border-top:1px solid #eeeeee;padding:20px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#666666;">
                            Anda menerima email ini karena berlangganan newsletter Apotek Inofarma.<br>
                            <a href="${escapeHtml(unsubscribe)}" style="color:#005bd3;">Berhenti berlangganan</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

  return {
    to: subscriber.email,
    subject,
    html,
    // the "Unsubscribe" button mail apps show, and its one-click POST
    headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

/**
 * The queued job: one newsletter to everyone subscribed. Each person gets a delivery row
 * once attempted, so a send restarted halfway skips the people already done; a bad
 * address fails alone and never stops the rest. Only a newsletter marked "mengirim" is sent.
 */
export async function sendNewsletter({ newsletterId }: { newsletterId: number }): Promise<void> {
  try {
    const [newsletter] = await db.select().from(newsletters).where(eq(newsletters.id, newsletterId)).limit(1);

    if (!newsletter || newsletter.status !== SENDING) {
      return;
    }

    let lastId = 0;

    // in pages of 100, like Laravel's chunkById()
    for (;;) {
      const page = await db
        .select()
        .from(subscribers)
        .where(and(eq(subscribers.status, SUBSCRIBED), gt(subscribers.id, lastId)))
        .orderBy(asc(subscribers.id))
        .limit(100);

      for (const subscriber of page) {
        await deliver(newsletter, subscriber);
      }

      if (page.length < 100) {
        break;
      }

      lastId = page[page.length - 1].id;
    }

    await finish(newsletter);
  } catch (error) {
    // SendNewsletter::failed()
    await db.update(newsletters).set({ status: FAILED, updatedAt: new Date() }).where(eq(newsletters.id, newsletterId));
    throw error;
  }
}

async function deliver(newsletter: Newsletter, subscriber: Subscriber): Promise<void> {
  const [done] = await db
    .select({ id: newsletterDeliveries.id })
    .from(newsletterDeliveries)
    .where(and(eq(newsletterDeliveries.newsletterId, newsletter.id), eq(newsletterDeliveries.subscriberId, subscriber.id)))
    .limit(1);

  if (done) {
    return;
  }

  // someone may unsubscribe while a long send is still running
  const [current] = await db.select({ status: subscribers.status }).from(subscribers).where(eq(subscribers.id, subscriber.id)).limit(1);

  if (current?.status !== SUBSCRIBED) {
    return;
  }

  const now = new Date();

  try {
    await sendMail(newsletterEmail(newsletter, subscriber));
    await db.insert(newsletterDeliveries).values({ newsletterId: newsletter.id, subscriberId: subscriber.id, status: "terkirim", sentAt: now, createdAt: now, updatedAt: now });
  } catch (error) {
    await db.insert(newsletterDeliveries).values({
      newsletterId: newsletter.id,
      subscriberId: subscriber.id,
      status: "gagal",
      error: [...(error instanceof Error ? error.message : String(error))].slice(0, 1000).join(""),
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function finish(newsletter: Newsletter): Promise<void> {
  const tally = async (status: string) =>
    (
      await db
        .select({ total: count() })
        .from(newsletterDeliveries)
        .where(and(eq(newsletterDeliveries.newsletterId, newsletter.id), eq(newsletterDeliveries.status, status)))
    )[0].total;
  const sent = await tally("terkirim");
  const failed = await tally("gagal");
  const now = new Date();

  await db
    .update(newsletters)
    .set({
      successCount: sent,
      failedCount: failed,
      // "gagal" only when nothing went out at all; a partly failed send is still "terkirim"
      status: sent === 0 && failed > 0 ? FAILED : SENT,
      sentAt: now,
      updatedAt: now,
    })
    .where(eq(newsletters.id, newsletter.id));
}
