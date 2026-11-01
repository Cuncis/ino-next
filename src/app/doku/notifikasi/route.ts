import { applyDokuNotification } from "@/server/payments/doku-payment";
import { dokuVerify } from "@/server/payments/doku-signature";

/**
 * The path DOKU signs, which must match the Notification URL set in DOKU's Back Office
 * byte for byte (Laravel's `services.doku.notification_path`).
 */
const NOTIFICATION_PATH = "/doku/notifikasi";

/**
 * POST /doku/notifikasi: DOKU's server-to-server notification, the only source of truth
 * for a payment (the browser coming back from DOKU never writes anything). Ported from
 * Webhooks\DokuWebhookController.
 *
 * DOKU can't send a CSRF token, so its signature is all that stands between this endpoint
 * and anyone claiming a payment succeeded. It is checked, on the exact bytes received,
 * before anything touches the database.
 */
export async function POST(request: Request) {
  const rawBody = new Uint8Array(await request.arrayBuffer());

  const verified = dokuVerify(
    {
      "client-id": request.headers.get("Client-Id"),
      "request-id": request.headers.get("Request-Id"),
      "request-timestamp": request.headers.get("Request-Timestamp"),
      signature: request.headers.get("Signature"),
    },
    rawBody,
    NOTIFICATION_PATH,
    process.env.DOKU_CLIENT_ID ?? "",
    process.env.DOKU_SECRET_KEY ?? "",
  );

  if (!verified) {
    console.warn("Notifikasi DOKU ditolak: tanda tangan tidak valid.", { request_id: request.headers.get("Request-Id") });

    return Response.json({ message: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    payload = null;
  }

  if (payload === null || typeof payload !== "object") {
    return Response.json({ message: "invalid payload" }, { status: 400 });
  }

  const payment = await applyDokuNotification(payload);

  if (!payment) {
    const order = (payload as { order?: { invoice_number?: unknown } }).order;

    console.info("Notifikasi DOKU untuk invoice yang tidak dikenal.", { invoice_number: order?.invoice_number ?? null });
  }

  return Response.json({ message: "ok" });
}
