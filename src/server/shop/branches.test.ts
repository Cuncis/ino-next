import { describe, expect, it } from "vitest";
import { fullAddress, isOpenAt, isOpenNow, todaysHours } from "./branches";

const hours = {
  operatingHours: {
    senin: { open: "08:00", close: "21:00" },
    minggu: { open: "09:00", close: "20:00" },
  },
};

// 2026-10-26 is a Monday; times are given in UTC and checked in Jakarta (UTC+7)
const at = (jakartaTime: string, date = "2026-10-26") => new Date(`${date}T${jakartaTime}+07:00`);

describe("opening hours (Jakarta time)", () => {
  it("is open between the posted hours, inclusive", () => {
    expect(isOpenAt(hours, at("08:00:00"))).toBe(true);
    expect(isOpenAt(hours, at("21:00:00"))).toBe(true);
    expect(isOpenAt(hours, at("21:00:01"))).toBe(false);
    expect(isOpenAt(hours, at("07:59:59"))).toBe(false);
  });

  it("uses the Jakarta day, not the server's", () => {
    // 23:30 UTC on Sunday is already 06:30 Monday in Jakarta, before opening
    expect(isOpenAt(hours, new Date("2026-10-25T23:30:00Z"))).toBe(false);
    expect(todaysHours(hours, new Date("2026-10-25T23:30:00Z"))).toBe("08:00 - 21:00");
    expect(todaysHours(hours, at("10:00:00", "2026-10-25"))).toBe("09:00 - 20:00");
  });

  it("is closed on a day without hours and when the branch isn't active", () => {
    expect(isOpenAt(hours, at("10:00:00", "2026-10-27"))).toBe(false);
    expect(todaysHours(hours, at("10:00:00", "2026-10-27"))).toBeNull();
    expect(isOpenNow({ ...hours, status: "tutup sementara" }, at("10:00:00"))).toBe(false);
    expect(isOpenNow({ ...hours, status: "aktif" }, at("10:00:00"))).toBe(true);
  });
});

describe("fullAddress", () => {
  it("joins the filled-in parts, dropping empty ones like PHP's filter()", () => {
    expect(
      fullAddress({ addressLine: "Jl. Jengki No.28", kelurahan: null, kecamatan: "Makasar", kota: "Jakarta Timur", provinsi: "DKI Jakarta", postalCode: "" }),
    ).toBe("Jl. Jengki No.28, Makasar, Jakarta Timur, DKI Jakarta");
  });
});
