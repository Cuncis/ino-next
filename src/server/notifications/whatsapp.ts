import { normalizePhone } from "@/lib/phone";

/**
 * Sends approved WhatsApp templates through Meta's Cloud API, ported from
 * App\Support\Notifications\WhatsAppClient. Without WHATSAPP_TOKEN and
 * WHATSAPP_PHONE_NUMBER_ID the message is only logged, as in Laravel. A rejected or
 * failed send is logged and never throws: an order update must not fail over a message.
 */
const BASE_URL = "https://graph.facebook.com/v21.0";

export type WhatsAppMessage = { template: string; parameters: string[]; logFallback: string };

/** The template names configured in Meta's WhatsApp Manager. */
export const WHATSAPP_TEMPLATES = {
  orderShipped: () => process.env.WHATSAPP_TEMPLATE_ORDER_SHIPPED || "pesanan_dikirim",
  orderReadyForPickup: () => process.env.WHATSAPP_TEMPLATE_ORDER_READY || "pesanan_siap_diambil",
};

/** What was "sent" while WhatsApp isn't configured, newest last (for tests). */
export const loggedWhatsApp: { to: string; message: WhatsAppMessage }[] = [];

export async function sendWhatsAppTemplate(to: string, message: WhatsAppMessage, fetcher: typeof fetch = fetch): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    loggedWhatsApp.push({ to, message });
    console.info(`WhatsApp (belum dikonfigurasi) ke ${to}: ${message.logFallback}`);

    return;
  }

  const body = {
    messaging_product: "whatsapp",
    to: normalizePhone(to),
    type: "template",
    template: {
      name: message.template,
      language: { code: "id" },
      ...(message.parameters.length === 0
        ? {}
        : { components: [{ type: "body", parameters: message.parameters.map((text) => ({ type: "text", text })) }] }),
    },
  };

  try {
    const response = await fetcher(`${BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      console.warn("WhatsApp Cloud API menolak pesan.", { to, template: message.template, response: await response.json().catch(() => null) });
    }
  } catch (error) {
    console.error(error);
  }
}
