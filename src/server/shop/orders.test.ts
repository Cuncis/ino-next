import { describe, expect, it } from "vitest";
import { canPay, orderSteps, shipmentStatusLabel } from "./orders";

const at = new Date("2026-11-01T03:00:00Z");
const base = { createdAt: at, paidAt: null, readyAt: null, completedAt: null };

describe("orderSteps", () => {
  it("marks steps before the current status done and the current one in progress", () => {
    expect(orderSteps({ ...base, status: "pembayaran diterima", fulfilment: "antar", paidAt: at })).toEqual([
      { label: "Pesanan Dibuat", state: "done", at: "01 Nov 2026, 10:00" },
      { label: "Pembayaran Diterima", state: "current", at: "01 Nov 2026, 10:00" },
      { label: "Siap Dikirim", state: "pending", at: null },
      { label: "Dikirim", state: "pending", at: null },
      { label: "Diterima", state: "pending", at: null },
    ]);
  });

  it("shows a finished order's last step as done, and pickup has its own steps", () => {
    const steps = orderSteps({ ...base, status: "selesai", fulfilment: "ambil", completedAt: at });

    expect(steps.map((step) => step.label)).toEqual(["Pesanan Dibuat", "Pembayaran Diterima", "Siap Diambil", "Diambil"]);
    expect(steps.every((step) => step.state === "done")).toBe(true);
  });

  it("has no timeline for a cancelled or expired order", () => {
    expect(orderSteps({ ...base, status: "dibatalkan", fulfilment: "antar" })).toEqual([]);
    expect(orderSteps({ ...base, status: "kedaluwarsa", fulfilment: "ambil" })).toEqual([]);
  });
});

describe("order actions and labels", () => {
  it("offers payment only to an online order still waiting for it", () => {
    expect(canPay({ status: "menunggu pembayaran", paymentStatus: "belum bayar", paymentMethod: "online" })).toBe(true);
    expect(canPay({ status: "menunggu pembayaran", paymentStatus: "belum bayar", paymentMethod: "tunai" })).toBe(false);
    expect(canPay({ status: "pembayaran diterima", paymentStatus: "lunas", paymentMethod: "QRIS" })).toBe(false);
  });

  it("translates Biteship's statuses, and nothing else", () => {
    expect(shipmentStatusLabel("droppingOff")).toBe("Menuju alamat Anda");
    expect(shipmentStatusLabel("returned")).toBe("Dikembalikan ke cabang");
    expect(shipmentStatusLabel("toString")).toBeNull();
    expect(shipmentStatusLabel(null)).toBeNull();
  });
});
