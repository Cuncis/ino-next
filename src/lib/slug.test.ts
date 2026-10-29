import { afterAll, describe, expect, it } from "vitest";
import { db, settings } from "@/db";
import { withRollback } from "@/test/db";
import { slugify, uniqueSlug } from "./slug";

afterAll(() => db.$client.end());

describe("slugify", () => {
  // Expected values come from Laravel's Str::slug()
  it.each([
    ["Vitamin C", "vitamin-c"],
    ["Paracetamol 500 mg", "paracetamol-500-mg"],
    ["Obat Batuk & Flu", "obat-batuk-flu"],
    ["Café Crème", "cafe-creme"],
    ["Sirup_Anak", "sirup-anak"],
    ["email@inofarma.com", "email-at-inofarmacom"],
    ["  --Halo  Dunia--  ", "halo-dunia"],
    ["Ünïcödé Ñame", "unicode-name"],
    ["100% Asli!", "100-asli"],
    ["Kesehatan/Kecantikan", "kesehatankecantikan"],
    ["Teh Hijau (Green Tea)", "teh-hijau-green-tea"],
    ["日本語", ""],
    ["ẞtraße", "sstrasse"],
  ])("slugify(%j) is %j", (value, expected) => {
    expect(slugify(value)).toBe(expected);
  });
});

describe("uniqueSlug", () => {
  // settings.key stands in for any unique slug column
  it("appends -2, -3… until the slug is free, skipping the record being edited", async () => {
    await withRollback(async (tx) => {
      await tx.insert(settings).values([{ key: "zz-test-vitamin-c" }, { key: "zz-test-vitamin-c-2" }]);
      const [own] = await tx.insert(settings).values({ key: "zz-test-obat" }).returning({ id: settings.id });

      expect(await uniqueSlug({ table: settings, column: settings.key, value: "ZZ Test Vitamin C", executor: tx })).toBe("zz-test-vitamin-c-3");
      expect(await uniqueSlug({ table: settings, column: settings.key, value: "ZZ Test Baru", executor: tx })).toBe("zz-test-baru");
      expect(
        await uniqueSlug({ table: settings, column: settings.key, value: "ZZ Test Obat", idColumn: settings.id, ignoreId: own.id, executor: tx }),
      ).toBe("zz-test-obat");
      expect(await uniqueSlug({ table: settings, column: settings.key, value: "ZZ Test Obat", executor: tx })).toBe("zz-test-obat-2");
    });
  });
});
