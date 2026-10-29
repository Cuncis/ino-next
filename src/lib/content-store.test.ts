import { afterAll, describe, expect, it } from "vitest";
import { branches, db, settings } from "@/db";
import { withRollback } from "@/test/db";
import { getSetting, lines, paragraphs, readContent, writeContent } from "./content-store";

afterAll(() => db.$client.end());

describe("getSetting", () => {
  it("prefers a branch's own row over the national one", async () => {
    await withRollback(async (tx) => {
      const [branch] = await tx.select({ id: branches.id }).from(branches).limit(1);

      await tx.insert(settings).values([
        { key: "zz.test.greeting", value: "nasional" },
        { key: "zz.test.greeting", value: "cabang", branchId: branch.id },
      ]);

      expect(await getSetting("zz.test.greeting", null, tx)).toBe("nasional");
      expect(await getSetting("zz.test.greeting", branch.id, tx)).toBe("cabang");
      expect(await getSetting("zz.test.greeting", branch.id + 999_999, tx)).toBe("nasional");
      expect(await getSetting("zz.test.missing", null, tx)).toBeNull();
    });
  });
});

describe("readContent / writeContent", () => {
  it("round-trips JSON in one national row, updating it in place", async () => {
    await withRollback(async (tx) => {
      expect(await readContent("zz.test.content", tx)).toEqual({});

      await writeContent("zz.test.content", { title: "Beranda", url: "/media/images/hero/1.png" }, tx);
      await writeContent("zz.test.content", { title: "Beranda Baru" }, tx);

      expect(await readContent("zz.test.content", tx)).toEqual({ title: "Beranda Baru" });

      const rows = await tx.select().from(settings).where((await import("drizzle-orm")).eq(settings.key, "zz.test.content"));

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ branchId: null, type: "json", value: '{"title":"Beranda Baru"}' });
    });
  });

  it("treats invalid or non-object JSON as empty", async () => {
    await withRollback(async (tx) => {
      await tx.insert(settings).values([
        { key: "zz.test.broken", value: "{not json" },
        { key: "zz.test.scalar", value: '"teks"' },
      ]);

      expect(await readContent("zz.test.broken", tx)).toEqual({});
      expect(await readContent("zz.test.scalar", tx)).toEqual({});
    });
  });
});

describe("text splitting", () => {
  it("splits paragraphs on blank lines and lists on line breaks", () => {
    expect(paragraphs("  Satu\nbaris dua\r\n\r\n  Tiga  \n \n\nEmpat ")).toEqual(["Satu\nbaris dua", "Tiga", "Empat"]);
    expect(lines(" A \r\n\nB\rC  D ")).toEqual(["A", "B", "C", "D"]);
    expect(paragraphs("   ")).toEqual([]);
  });
});
