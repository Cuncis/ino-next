import { describe, expect, it } from "vitest";
import { renderNotification } from "@/lib/mail";
import { orderMail, orderWhatsApp, type OrderMessageContext } from "./customer";
import { filamentMessage, limitText } from "./staff";

process.env.APP_URL = "https://inofarma.test";

const context: OrderMessageContext = {
  customerName: "Kirana",
  branchName: "Apotek Inofarma Pisangan Lama",
  order: {
    number: "INO-CB-014-261102-ABCDE",
    grandTotal: 1250000,
    fulfilment: "ambil",
    paymentMethod: "QRIS",
    pickupCode: "K7Q2PX",
    pickupCodeExpiresAt: new Date("2026-11-04T07:30:00Z"),
    status: "siap diambil",
  },
  shipment: { courierName: "JNE", courierServiceName: "Reguler", waybillId: "WB123" },
};

describe("customer order messages", () => {
  it("writes Laravel's emails", () => {
    expect(orderMail("OrderConfirmed", context)).toEqual({
      subject: "Pesanan #INO-CB-014-261102-ABCDE Diterima — Inofarma",
      greeting: "Halo, Kirana!",
      introLines: [
        "Pesanan Anda #INO-CB-014-261102-ABCDE dari Apotek Inofarma Pisangan Lama sudah kami terima.",
        "Total: Rp1.250.000",
        "Pesanan bisa diambil di cabang setelah siap.",
      ],
      action: { text: "Lacak Pesanan", url: "https://inofarma.test/track-order/INO-CB-014-261102-ABCDE" },
      outroLines: ["Terima kasih sudah berbelanja di Inofarma."],
    });
    expect(orderMail("OrderReadyForPickup", context).introLines[2]).toBe(
      "Tunjukkan kode ini (atau QR di halaman lacak pesanan) ke kasir. Berlaku sampai 04 Nov 2026, 14:30.",
    );
    expect(orderMail("OrderShipped", context).introLines).toEqual([
      "Pesanan Anda #INO-CB-014-261102-ABCDE sudah diserahkan ke kurir.",
      "Kurir: JNE Reguler",
      "No. Resi: WB123",
    ]);
    expect(orderMail("OrderCancelled", { ...context, order: { ...context.order, status: "kedaluwarsa" } }).introLines[0]).toBe(
      "Pesanan Anda #INO-CB-014-261102-ABCDE dibatalkan karena melewati batas waktu.",
    );
    expect(orderMail("OrderCompleted", context).introLines[0]).toBe("Pesanan Anda #INO-CB-014-261102-ABCDE sudah diambil. Terima kasih sudah berbelanja di Inofarma!");
    expect(orderMail("PaymentReceived", { ...context, order: { ...context.order, paymentMethod: null } }).introLines[2]).toBe("Metode: —");
  });

  it("sends WhatsApp only when an order ships or is ready", () => {
    expect(orderWhatsApp("OrderReadyForPickup", context)).toEqual({
      template: "pesanan_siap_diambil",
      parameters: ["Kirana", "INO-CB-014-261102-ABCDE", "K7Q2PX"],
      logFallback: "Pesanan #INO-CB-014-261102-ABCDE siap diambil. Kode: K7Q2PX.",
    });
    expect(orderWhatsApp("OrderShipped", { ...context, shipment: null })?.parameters).toEqual(["Kirana", "INO-CB-014-261102-ABCDE", "-"]);
    expect(orderWhatsApp("PaymentReceived", context)).toBeNull();
  });
});

describe("staff notifications", () => {
  it("are stored in Filament's format", () => {
    const message = filamentMessage("Pesanan baru", "#INO-1 — Rp10.000", { label: "Lihat Pesanan", url: "https://inofarma.test/admin/pesanan/7" });

    expect(message).toMatchObject({ title: "Pesanan baru", body: "#INO-1 — Rp10.000", format: "filament", duration: "persistent" });
    expect(message.actions[0]).toMatchObject({ name: "view", label: "Lihat Pesanan", url: "https://inofarma.test/admin/pesanan/7", view: "filament::components.link" });
  });

  it("shorten a chat message like Str::limit", () => {
    expect(limitText("pendek", 120)).toBe("pendek");
    expect(limitText(`${"a".repeat(119)} bcd`, 120)).toBe(`${"a".repeat(119)}...`);
  });
});

describe("email lines", () => {
  it("are joined onto one line, as MailMessage::line() does (a quoted chat reply too)", () => {
    const { html, text } = renderNotification({
      subject: "s",
      greeting: "Halo Udin,",
      introLines: ["Admin Apotek Inofarma membalas pesan Anda:", "> Ada, kak.\n> Stok <5>"],
      action: { text: "Lanjutkan chat", url: "https://inofarma.test?chat=abc" },
      outroLines: [],
    });

    expect(html).toMatch(/<p[^>]*>&gt; Ada, kak. &gt; Stok &lt;5&gt;<\/p>/);
    expect(text).toContain("> Ada, kak. > Stok <5>");
  });
});
