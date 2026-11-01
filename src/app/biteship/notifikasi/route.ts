import { timingSafeEqual } from "node:crypto";
import { applyBiteshipWebhookEvent } from "@/server/shipping/shipment";

/**
 * POST /biteship/notifikasi?token=…: Biteship's event notification (`order.status`,
 * `order.waybill_id`, `order.price`). Ported from Webhooks\BiteshipWebhookController.
 *
 * Biteship signs nothing, so the `?token=` this app generated (BITESHIP_WEBHOOK_TOKEN)
 * and pasted into the Notification URL in Biteship's dashboard is the whole security
 * boundary. The one exception is an empty request: Biteship's check when the URL is
 * installed, which carries no event and changes nothing.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  const body = await requestBody(request);

  // Laravel's `$request->all()`: the query and the body together
  if (Object.keys(query).length === 0 && Object.keys(body).length === 0) {
    return Response.json({ message: "ok" });
  }

  const expected = process.env.BITESHIP_WEBHOOK_TOKEN ?? "";

  if (!expected || !safeEqual(expected, url.searchParams.get("token") ?? "")) {
    console.warn("Notifikasi Biteship ditolak: token tidak valid.");

    return Response.json({ message: "invalid token" }, { status: 401 });
  }

  // Laravel stored the token with the event; the secret is left out here.
  const payload = { ...query, ...body };

  delete payload.token;

  const shipment = await applyBiteshipWebhookEvent(payload);

  if (!shipment) {
    console.info("Notifikasi Biteship untuk order_id yang tidak dikenal.", { order_id: payload.order_id ?? null });
  }

  return Response.json({ message: "ok" });
}

/** The JSON (or form) body as an object; anything else counts as empty. */
async function requestBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();

  if (text.trim() === "") {
    return {};
  }

  if ((request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text));
  }

  try {
    const parsed: unknown = JSON.parse(text);

    return parsed !== null && typeof parsed === "object" ? { ...(parsed as Record<string, unknown>) } : {};
  } catch {
    return {};
  }
}

function safeEqual(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);

  return a.length === b.length && timingSafeEqual(a, b);
}
