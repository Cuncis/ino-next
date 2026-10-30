import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Laravel's own error page (errors::minimal, rendered by Laravel into
 * laravel-error-page.html), for Route Handlers that answer a browser with an error:
 * e.g. a verification link with a bad signature is "403 | Invalid signature.".
 */
const templatePath = path.join(/* turbopackIgnore: true */ process.cwd(), "src", "server", "laravel-error-page.html");
let template: string | undefined;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

export function errorPageResponse(status: number, title: string, message: string = title): Response {
  template ??= readFileSync(templatePath, "utf8");

  const html = template
    .replace("PLACEHOLDERTITLE", escapeHtml(title))
    .replace("PLACEHOLDERCODE", String(status))
    .replace("PLACEHOLDERMESSAGE", escapeHtml(message));

  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
