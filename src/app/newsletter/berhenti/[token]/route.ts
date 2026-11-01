import { errorPageResponse } from "@/server/error-page";
import { subscriberByToken, SUBSCRIBED, unsubscribe, type Subscriber } from "@/server/newsletter/subscribers";

/**
 * The page behind every newsletter's "Berhenti berlangganan" link, ported from
 * Shop\NewsletterUnsubscribeController and newsletter-unsubscribe.blade.php.
 *
 * Opening the link only asks; the opt-out itself is a POST, because mail scanners and
 * link previews open links on their own. The POST is also what a mail app's one-click
 * unsubscribe button sends (List-Unsubscribe-Post), with no session, so it needs no
 * same-site check: the 64-character token is the key.
 */
export async function GET(_request: Request, { params }: RouteContext<"/newsletter/berhenti/[token]">) {
  const subscriber = await subscriberByToken((await params).token);

  return subscriber ? page(subscriber, subscriber.status !== SUBSCRIBED) : errorPageResponse(404, "Not Found");
}

export async function POST(_request: Request, { params }: RouteContext<"/newsletter/berhenti/[token]">) {
  const subscriber = await subscriberByToken((await params).token);

  return subscriber ? page(await unsubscribe(subscriber), true) : errorPageResponse(404, "Not Found");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function page(subscriber: Subscriber, done: boolean): Response {
  const email = escapeHtml(subscriber.email);
  const content = done
    ? `            <h1>Anda sudah berhenti berlangganan</h1>
            <p>${email} tidak akan menerima newsletter Apotek Inofarma lagi.</p>
            <a class="plain" href="/">Kembali ke beranda</a>`
    : `            <h1>Berhenti berlangganan?</h1>
            <p>Anda tidak akan lagi menerima newsletter Apotek Inofarma di <strong>${email}</strong>.</p>
            <form method="POST" action="/newsletter/berhenti/${escapeHtml(subscriber.unsubscribeToken)}">
                <button type="submit">Ya, berhenti berlangganan</button>
            </form>
            <p style="margin-top:20px;"><a class="plain" href="/">Batal, kembali ke beranda</a></p>`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Berhenti Berlangganan - Apotek Inofarma</title>
    <link rel="icon" type="image/png" sizes="96x96" href="/icon.png">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="apple-touch-icon" href="/apple-icon.png">
    <style>
        body { margin:0; background:#F3F5F6; font-family:Arial,Helvetica,sans-serif; color:#222; }
        main { max-width:460px; margin:64px auto; background:#fff; border:1px solid #eee; padding:32px; text-align:center; }
        h1 { margin:0 0 12px; font-size:22px; color:#0900AA; }
        p { margin:0 0 20px; line-height:1.6; color:#555; font-size:14px; }
        button, a.btn { display:inline-block; border:0; background:#0900AA; color:#fff; padding:12px 28px; font-size:14px; font-weight:bold; text-decoration:none; cursor:pointer; }
        a.plain { color:#005bd3; font-size:13px; }
    </style>
</head>
<body>
    <main>
${content}
    </main>
</body>
</html>
`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=UTF-8" } });
}
