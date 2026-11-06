import { describe, expect, it } from "vitest";
import { isOpenNow } from "./branches";

/** Branch::getIsOpenNowAttribute(): an active branch inside today's posted hours, in Jakarta time (both ends included). */
describe("isOpenNow", () => {
  const hours = { senin: { open: "08:00", close: "21:00" }, minggu: { open: "09:00", close: "20:00" } };
  // 2026-11-09 is a Monday; Jakarta is UTC+7
  const at = (time: string) => new Date(`2026-11-09T${time}+07:00`);

  it("follows the hours of the day in Jakarta", () => {
    expect(isOpenNow({ status: "aktif", operatingHours: hours }, at("08:00:00"))).toBe(true);
    expect(isOpenNow({ status: "aktif", operatingHours: hours }, at("21:00:00"))).toBe(true);
    expect(isOpenNow({ status: "aktif", operatingHours: hours }, at("21:00:01"))).toBe(false);
    expect(isOpenNow({ status: "aktif", operatingHours: hours }, at("07:59:59"))).toBe(false);
    // Sunday 08:30 in Jakarta, before Sunday's 09:00
    expect(isOpenNow({ status: "aktif", operatingHours: hours }, new Date("2026-11-08T08:30:00+07:00"))).toBe(false);
  });

  it("is closed whenever the branch isn't active, or has no hours for the day", () => {
    expect(isOpenNow({ status: "tutup sementara", operatingHours: hours }, at("12:00:00"))).toBe(false);
    expect(isOpenNow({ status: "aktif", operatingHours: null }, at("12:00:00"))).toBe(false);
    expect(isOpenNow({ status: "aktif", operatingHours: hours }, new Date("2026-11-10T12:00:00+07:00"))).toBe(false);
  });
});
