import { describe, expect, it } from "vitest";
import { fulfilmentStageFor, ORDER_STATUSES, orderStatusesFor, stockLabel, toLabel, toValue } from "./admin-options";
import { paymentStatusFor, statusesFor } from "./order-status";

describe("order status flows", () => {
  it("lists delivery and pickup statuses in flow order, ending states last", () => {
    expect(statusesFor("antar")).toEqual(["menunggu pembayaran", "pembayaran diterima", "siap dikirim", "dikirim", "selesai", "dibatalkan", "kedaluwarsa"]);
    expect(statusesFor("ambil")).toEqual(["menunggu pembayaran", "pembayaran diterima", "siap diambil", "selesai", "dibatalkan", "kedaluwarsa"]);
  });

  it("gives the labelled dropdown for one fulfilment", () => {
    expect(Object.keys(orderStatusesFor("ambil"))).toEqual([
      "Menunggu Pembayaran",
      "Pembayaran Diterima",
      "Siap Diambil",
      "Selesai",
      "Dibatalkan",
      "Kedaluwarsa",
    ]);
  });

  it("derives the payment status for a hand-set order status", () => {
    expect(paymentStatusFor("siap dikirim")).toBe("lunas");
    expect(paymentStatusFor("dibatalkan", "lunas")).toBe("lunas");
    expect(paymentStatusFor("dibatalkan")).toBe("belum bayar");
    expect(paymentStatusFor("selesai", "refund")).toBe("refund");
    expect(paymentStatusFor("menunggu pembayaran", "gagal")).toBe("belum bayar");
  });
});

describe("labels", () => {
  it("maps between stored values and labels both ways", () => {
    expect(toLabel(ORDER_STATUSES, "siap diambil")).toBe("Siap Diambil");
    expect(toLabel(ORDER_STATUSES, "diproses")).toBeNull();
    expect(toLabel(ORDER_STATUSES, null)).toBeNull();
    expect(toValue(ORDER_STATUSES, "Menunggu Pembayaran")).toBe("menunggu pembayaran");
    expect(() => toValue(ORDER_STATUSES, "Diproses")).toThrow("Status tidak dikenal: Diproses");
  });

  it("groups order statuses into the admin's fulfilment stages", () => {
    expect(fulfilmentStageFor("siap dikirim")).toBe("Sedang Diproses");
    expect(fulfilmentStageFor("selesai")).toBe("Terpenuhi");
    expect(fulfilmentStageFor("unknown")).toBeNull();
  });

  it("reads stock as a badge", () => {
    expect(stockLabel(0)).toBe("Habis");
    expect(stockLabel(20)).toBe("Stok Menipis");
    expect(stockLabel(21)).toBe("Tersedia");
  });
});
