import { describe, expect, it } from "vitest";
import { diffForHumans } from "./diff-for-humans";

const now = new Date("2026-11-02T05:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("diffForHumans", () => {
  it("matches Carbon's Indonesian and English wording", () => {
    const cases = [0, 1, 59, 60, 90, 3599, 3600, 86399, 86400, 604800, 1209600, 2592000, 5184000, 31536000, 63072000];

    expect(cases.map((seconds) => diffForHumans(ago(seconds), "id", now))).toEqual([
      "0 detik yang lalu", "1 detik yang lalu", "59 detik yang lalu", "1 menit yang lalu", "1 menit yang lalu", "59 menit yang lalu", "1 jam yang lalu",
      "23 jam yang lalu", "1 hari yang lalu", "1 minggu yang lalu", "2 minggu yang lalu", "4 minggu yang lalu", "1 bulan yang lalu", "1 tahun yang lalu", "2 tahun yang lalu",
    ]);
    expect([0, 1, 90, 7200, 1209600, 5184000, 63072000].map((seconds) => diffForHumans(ago(seconds), "en", now))).toEqual([
      "0 seconds ago", "1 second ago", "1 minute ago", "2 hours ago", "2 weeks ago", "1 month ago", "2 years ago",
    ]);
  });
});
