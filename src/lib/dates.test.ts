import { describe, expect, it } from "vitest";
import { iso8601 } from "./dates";

describe("iso8601", () => {
  it("writes the Jakarta time with its offset, like Carbon's toIso8601String()", () => {
    expect(iso8601(new Date("2026-10-12T10:22:32Z"))).toBe("2026-10-12T17:22:32+07:00");
    expect(iso8601(null)).toBeNull();
  });
});
