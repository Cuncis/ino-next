import { describe, expect, it } from "vitest";
import { count, money, moneyShort, rupiah } from "./money";

describe("money (screens)", () => {
  it("formats whole rupiah with a space and Indonesian separators", () => {
    expect(money(1350000)).toBe("Rp 1.350.000");
    expect(money(0)).toBe("Rp 0");
    expect(money(999.6)).toBe("Rp 1.000");
  });

  it("shortens large amounts for dashboard tiles", () => {
    expect(moneyShort(1250000)).toBe("Rp 1,25 jt");
    expect(moneyShort(2500)).toBe("Rp 2,5 rb");
    expect(moneyShort(3_000_000_000)).toBe("Rp 3 M");
    expect(moneyShort(950)).toBe("Rp 950");
  });

  it("formats counts", () => {
    expect(count(12345)).toBe("12.345");
  });
});

describe("rupiah (plain text, e.g. emails)", () => {
  // Expected values come from Laravel's App\Support\Money::rupiah()
  it.each([
    [0, "Rp0"],
    [5, "Rp5"],
    [1350000, "Rp1.350.000"],
    [999999999, "Rp999.999.999"],
    [-2500, "Rp-2.500"],
  ])("rupiah(%i) is %s", (amount, expected) => {
    expect(rupiah(amount)).toBe(expected);
  });
});
