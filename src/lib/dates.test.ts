import { describe, expect, it } from "vitest";
import { indonesianDate, iso8601 } from "./dates";

describe("iso8601", () => {
  it("writes the Jakarta time with its offset, like Carbon's toIso8601String()", () => {
    expect(iso8601(new Date("2026-10-12T10:22:32Z"))).toBe("2026-10-12T17:22:32+07:00");
    expect(iso8601(null)).toBeNull();
  });
});

describe("indonesianDate", () => {
  it("writes Carbon's Indonesian d M Y (and H:i) in Jakarta time", () => {
    expect(indonesianDate(new Date("2026-08-05T18:30:00Z"))).toBe("06 Agt 2026");
    expect(indonesianDate(new Date("2026-05-01T03:04:00Z"), true)).toBe("01 Mei 2026, 10:04");
    expect(indonesianDate(null)).toBeNull();
  });
});
