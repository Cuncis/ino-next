import { describe, expect, it } from "vitest";
import { oneDecimal, purchaseLimit, shortIndonesianDate } from "./catalog";

describe("catalog formatting", () => {
  it("rounds ratings like PHP's number_format, without float error", () => {
    expect(oneDecimal("4.35")).toBe("4.4");
    expect(oneDecimal("4.25")).toBe("4.3");
    expect(oneDecimal("4.00")).toBe("4.0");
    expect(oneDecimal("0.04")).toBe("0.0");
    expect(oneDecimal("5.00")).toBe("5.0");
  });

  it("writes expiry dates the way Carbon does in Indonesian", () => {
    expect(shortIndonesianDate("2026-08-05")).toBe("05 Agt 2026");
    expect(shortIndonesianDate("2026-10-29")).toBe("29 Okt 2026");
    expect(shortIndonesianDate("2027-05-01")).toBe("01 Mei 2027");
  });

  it("uses the product's own purchase limit, else 2", () => {
    expect(purchaseLimit(null)).toBe(2);
    expect(purchaseLimit(0)).toBe(2);
    expect(purchaseLimit(5)).toBe(5);
  });
});
