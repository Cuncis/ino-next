import { afterAll, describe, expect, it } from "vitest";
import { db, settings } from "@/db";
import { withRollback } from "@/test/db";
import { nextCode } from "./code-sequence";

afterAll(() => db.$client.end());

// settings.key stands in for any code column
describe("nextCode", () => {
  it("continues after the highest number, padded", async () => {
    await withRollback(async (tx) => {
      await tx.insert(settings).values([{ key: "ZZT-001" }, { key: "ZZT-009" }, { key: "ZZTX-500" }]);

      expect(await nextCode({ table: settings, column: settings.key, prefix: "ZZT-", executor: tx })).toBe("ZZT-010");
    });
  });

  it("counts codes whose suffix isn't a number as 0, like PHP's (int) cast", async () => {
    // customer order numbers (INO-CB-014-261012-GADCY) share the INO- prefix with hand-typed INO-2445
    await withRollback(async (tx) => {
      await tx.insert(settings).values([{ key: "ZZO-2445" }, { key: "ZZO-CB-014-261012-GADCY" }, { key: "ZZO-12abc" }]);

      expect(await nextCode({ table: settings, column: settings.key, prefix: "ZZO-", pad: 0, floor: 2450, executor: tx })).toBe("ZZO-2451");
      expect(await nextCode({ table: settings, column: settings.key, prefix: "ZZO-", pad: 0, executor: tx })).toBe("ZZO-2446");
    });
  });

  it("starts from the floor on an empty series and treats LIKE wildcards in the prefix literally", async () => {
    await withRollback(async (tx) => {
      await tx.insert(settings).values([{ key: "ZZ%-777" }, { key: "ZZQ-888" }]);

      expect(await nextCode({ table: settings, column: settings.key, prefix: "ZZ_-", executor: tx })).toBe("ZZ_-001");
      expect(await nextCode({ table: settings, column: settings.key, prefix: "ZZ%-", pad: 5, executor: tx })).toBe("ZZ%-00778");
    });
  });
});
