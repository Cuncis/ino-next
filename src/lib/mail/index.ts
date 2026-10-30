import { readFileSync } from "node:fs";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Sending email, with the Laravel app's look: notification emails use Laravel's own
 * default layout (rendered once by Laravel into laravel-notification.html/.txt with
 * placeholders), so a customer can't tell which app sent them.
 *
 * `MAIL_MAILER=log` (the Laravel app's setting in development) writes each email to the
 * server log instead of sending it; `MAIL_MAILER=smtp` sends through the SMTP_* settings.
 */
export type NotificationMail = {
  subject: string;
  greeting: string;
  introLines: string[];
  action: { text: string; url: string };
  outroLines: string[];
};

export type Recipient = { email: string; name?: string | null };

// read at runtime; turbopackIgnore keeps the build from treating the folder as a bundle asset
const templateDir = path.join(/* turbopackIgnore: true */ process.cwd(), "src", "lib", "mail");
let templates: { html: string; text: string } | undefined;

function loadTemplates() {
  templates ??= {
    html: readFileSync(path.join(templateDir, "laravel-notification.html"), "utf8"),
    text: readFileSync(path.join(templateDir, "laravel-notification.txt"), "utf8"),
  };

  return templates;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

/** Repeats the element around a line placeholder once per line (none when there are no lines). */
function repeatLine(html: string, placeholder: string, lines: string[]): string {
  const at = html.indexOf(placeholder);
  const start = html.lastIndexOf("<p", at);
  const end = html.indexOf("</p>", at) + "</p>".length;
  const element = html.slice(start, end);

  return html.slice(0, start) + lines.map((line) => element.replace(placeholder, escapeHtml(line))).join("\n") + html.slice(end);
}

function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function currentYear(): string {
  return new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", year: "numeric" }).format(new Date());
}

/** The HTML and plain-text bodies of a notification email. */
export function renderNotification(mail: NotificationMail): { html: string; text: string } {
  const { html, text } = loadTemplates();
  let body = repeatLine(html, "PLACEHOLDERINTRO", mail.introLines);

  body = repeatLine(body, "PLACEHOLDEROUTRO", mail.outroLines)
    .replace("PLACEHOLDERGREETING", escapeHtml(mail.greeting))
    .replaceAll("PLACEHOLDERACTIONTEXT", escapeHtml(mail.action.text))
    .replaceAll("https://action-url.invalid/", escapeHtml(mail.action.url))
    .replace("https://app-url.invalid", escapeHtml(appUrl()))
    .replace("© 2026", `© ${currentYear()}`);

  const plain = text
    .replace("PLACEHOLDERGREETING", mail.greeting)
    .replace("PLACEHOLDERINTRO", mail.introLines.join("\n\n"))
    .replace("PLACEHOLDEROUTRO", mail.outroLines.join("\n\n"))
    .replaceAll("PLACEHOLDERACTIONTEXT", mail.action.text)
    .replaceAll("https://action-url.invalid/", mail.action.url)
    .replace("https://app-url.invalid", appUrl())
    .replace("© 2026", `© ${currentYear()}`);

  return { html: body, text: plain };
}

let transport: Transporter | undefined;

function smtp(): Transporter {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });

  return transport;
}

function from(): string {
  const address = process.env.MAIL_FROM || "hello@example.com";
  const name = process.env.MAIL_FROM_NAME || "Inofarma";

  return `"${name.replace(/"/g, "")}" <${address}>`;
}

export async function sendNotification(to: Recipient, mail: NotificationMail): Promise<void> {
  const { html, text } = renderNotification(mail);
  const recipient = to.name ? `"${to.name.replace(/"/g, "")}" <${to.email}>` : to.email;

  if ((process.env.MAIL_MAILER ?? "log") !== "smtp") {
    console.info(`[mail] To: ${recipient}\n[mail] Subject: ${mail.subject}\n${text}`);

    return;
  }

  await smtp().sendMail({ from: from(), to: recipient, subject: mail.subject, html, text });
}
