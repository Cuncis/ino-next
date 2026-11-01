import { and, asc, eq, isNull } from "drizzle-orm";
import { branches, customers, db, orders, shipments } from "@/db";
import { appUrl } from "@/lib/app-url";
import { indonesianDate } from "@/lib/dates";
import { sendNotification, type NotificationMail } from "@/lib/mail";
import { rupiah } from "@/lib/money";
import type { CustomerNotificationName } from "@/lib/queue";
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES, type WhatsAppMessage } from "./whatsapp";

/**
 * The customer's order messages, ported from App\Notifications\Order* and
 * PaymentReceived: an email each, and WhatsApp too when the order ships or is ready
 * for pickup. Built when the job runs, from the order as it is then (Laravel's queued
 * notifications reloaded the order the same way).
 */
type Order = typeof orders.$inferSelect;
type Shipment = typeof shipments.$inferSelect;

export type OrderMessageContext = {
  customerName: string;
  order: Pick<Order, "number" | "grandTotal" | "fulfilment" | "paymentMethod" | "pickupCode" | "pickupCodeExpiresAt" | "status">;
  branchName: string;
  shipment: Pick<Shipment, "courierName" | "courierServiceName" | "waybillId"> | null;
};

/** Which channels each message goes out on (`via()`). */
export const CUSTOMER_CHANNELS: Record<CustomerNotificationName, ("mail" | "whatsapp")[]> = {
  OrderConfirmed: ["mail"],
  PaymentReceived: ["mail"],
  OrderShipped: ["mail", "whatsapp"],
  OrderReadyForPickup: ["mail", "whatsapp"],
  OrderCompleted: ["mail"],
  OrderCancelled: ["mail"],
};

const trackUrl = (number: string) => appUrl(`/track-order/${encodeURIComponent(number)}`);

export function orderMail(name: CustomerNotificationName, { customerName, order, branchName, shipment }: OrderMessageContext): NotificationMail {
  const greeting = `Halo, ${customerName}!`;

  switch (name) {
    case "OrderConfirmed":
      return {
        subject: `Pesanan #${order.number} Diterima — Inofarma`,
        greeting,
        introLines: [
          `Pesanan Anda #${order.number} dari ${branchName} sudah kami terima.`,
          `Total: ${rupiah(order.grandTotal)}`,
          order.fulfilment === "antar" ? "Pesanan akan diantar ke alamat Anda." : "Pesanan bisa diambil di cabang setelah siap.",
        ],
        action: { text: "Lacak Pesanan", url: trackUrl(order.number) },
        outroLines: ["Terima kasih sudah berbelanja di Inofarma."],
      };
    case "PaymentReceived":
      return {
        subject: `Bukti Bayar Pesanan #${order.number} — Inofarma`,
        greeting,
        introLines: [`Pembayaran untuk pesanan #${order.number} sudah kami terima.`, `Jumlah: ${rupiah(order.grandTotal)}`, `Metode: ${order.paymentMethod ?? "—"}`],
        action: { text: "Lihat Pesanan", url: appUrl(`/pesanan/${encodeURIComponent(order.number)}`) },
        outroLines: ["Pesanan Anda sekarang sedang diproses."],
      };
    case "OrderShipped": {
      const introLines = [`Pesanan Anda #${order.number} sudah diserahkan ke kurir.`];

      if (shipment) {
        introLines.push(`Kurir: ${shipment.courierName ?? ""} ${shipment.courierServiceName ?? ""}`);

        if (shipment.waybillId) {
          introLines.push(`No. Resi: ${shipment.waybillId}`);
        }
      }

      return {
        subject: `Pesanan #${order.number} Sedang Dikirim — Inofarma`,
        greeting,
        introLines,
        action: { text: "Lacak Pesanan", url: trackUrl(order.number) },
        outroLines: ["Kami akan mengabari Anda lagi begitu pesanan sampai."],
      };
    }
    case "OrderReadyForPickup":
      return {
        subject: `Pesanan #${order.number} Siap Diambil — Inofarma`,
        greeting,
        introLines: [
          `Pesanan Anda #${order.number} sudah siap diambil di ${branchName}.`,
          `Kode ambil Anda: ${order.pickupCode ?? ""}`,
          `Tunjukkan kode ini (atau QR di halaman lacak pesanan) ke kasir. Berlaku sampai ${indonesianDate(order.pickupCodeExpiresAt, true) ?? ""}.`,
        ],
        action: { text: "Lihat Kode Ambil", url: trackUrl(order.number) },
        outroLines: [],
      };
    case "OrderCompleted":
      return {
        subject: `Pesanan #${order.number} Selesai — Inofarma`,
        greeting,
        introLines: [`Pesanan Anda #${order.number} sudah ${order.fulfilment === "ambil" ? "diambil" : "diterima"}. Terima kasih sudah berbelanja di Inofarma!`],
        action: { text: "Beri Ulasan", url: trackUrl(order.number) },
        outroLines: [],
      };
    case "OrderCancelled":
      return {
        subject: `Pesanan #${order.number} Dibatalkan — Inofarma`,
        greeting,
        introLines: [
          `Pesanan Anda #${order.number} dibatalkan ${order.status === "kedaluwarsa" ? "karena melewati batas waktu" : "sesuai permintaan Anda"}.`,
          "Bila sudah membayar, dana akan diproses sesuai kebijakan pengembalian dana.",
        ],
        // route('home') has no trailing slash
        action: { text: "Belanja Lagi", url: appUrl("/").replace(/\/$/, "") },
        outroLines: [],
      };
  }
}

export function orderWhatsApp(name: CustomerNotificationName, { customerName, order, shipment }: OrderMessageContext): WhatsAppMessage | null {
  if (name === "OrderShipped") {
    const waybill = shipment?.waybillId ?? "-";

    return {
      template: WHATSAPP_TEMPLATES.orderShipped(),
      parameters: [customerName, order.number, waybill],
      logFallback: `Pesanan #${order.number} sedang dikirim. No. Resi: ${waybill}.`,
    };
  }

  if (name === "OrderReadyForPickup") {
    return {
      template: WHATSAPP_TEMPLATES.orderReadyForPickup(),
      parameters: [customerName, order.number, order.pickupCode ?? ""],
      logFallback: `Pesanan #${order.number} siap diambil. Kode: ${order.pickupCode ?? ""}.`,
    };
  }

  return null;
}

/** The queued job: one message to one customer on one channel. */
export async function sendCustomerNotification(payload: { notification: CustomerNotificationName; orderId: number; customerId: number; channel: "mail" | "whatsapp" }) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, payload.customerId), isNull(customers.deletedAt)))
    .limit(1);
  const [order] = await db.select().from(orders).where(eq(orders.id, payload.orderId)).limit(1);

  // the account or the order is gone since: nothing to tell anyone
  if (!customer || !order) {
    return;
  }

  const [[branch], [shipment]] = await Promise.all([
    db.select({ name: branches.name }).from(branches).where(eq(branches.id, order.branchId)).limit(1),
    db.select().from(shipments).where(eq(shipments.orderId, order.id)).orderBy(asc(shipments.id)).limit(1),
  ]);
  const context: OrderMessageContext = { customerName: customer.name, order, branchName: branch?.name ?? "", shipment: shipment ?? null };

  if (payload.channel === "mail") {
    // routeNotificationForMail(): the address alone, no name
    await sendNotification({ email: customer.email }, orderMail(payload.notification, context));

    return;
  }

  const message = orderWhatsApp(payload.notification, context);

  // routeNotificationForWhatsapp(): the phone on the account
  if (message && customer.phone) {
    await sendWhatsAppTemplate(customer.phone, message);
  }
}
