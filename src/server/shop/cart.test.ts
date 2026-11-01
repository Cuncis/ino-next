import { describe, expect, it } from "vitest";
import { couponDiscount, couponIsExhausted, exceedsPurchaseLimit, type CartLine } from "./cart";

describe("coupon rules (Coupon model)", () => {
  it("gives a percentage, rounded half up, never more than the subtotal", () => {
    expect(couponDiscount({ type: "persentase", value: 10 }, 247400)).toBe(24740);
    expect(couponDiscount({ type: "persentase", value: 15 }, 1003)).toBe(150); // 150.45
    expect(couponDiscount({ type: "persentase", value: 50 }, 1001)).toBe(501); // 500.5 rounds up
    expect(couponDiscount({ type: "persentase", value: 150 }, 1000)).toBe(1000);
  });

  it("gives a fixed amount up to the subtotal, and nothing for free shipping", () => {
    expect(couponDiscount({ type: "nominal", value: 20000 }, 50000)).toBe(20000);
    expect(couponDiscount({ type: "nominal", value: 20000 }, 5000)).toBe(5000);
    expect(couponDiscount({ type: "ongkir gratis", value: 0 }, 50000)).toBe(0);
  });

  it("is used up only when it has a quota", () => {
    expect(couponIsExhausted({ quota: null, usedCount: 999 })).toBe(false);
    expect(couponIsExhausted({ quota: 3, usedCount: 2 })).toBe(false);
    expect(couponIsExhausted({ quota: 3, usedCount: 3 })).toBe(true);
  });
});

describe("purchase limit (Product::purchaseLimit)", () => {
  const line = (quantity: number, maxQtyPerOrder: number | null) => ({ quantity, product: { maxQtyPerOrder } }) as CartLine;

  it("uses the product's own limit, else 2", () => {
    expect(exceedsPurchaseLimit([line(2, null)])).toBe(false);
    expect(exceedsPurchaseLimit([line(3, null)])).toBe(true);
    expect(exceedsPurchaseLimit([line(5, 5)])).toBe(false);
    expect(exceedsPurchaseLimit([line(1, 1), line(2, 1)])).toBe(true);
  });
});
