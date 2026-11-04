import { describe, expect, it } from "vitest";
import { assertColumns, csvLine, CsvError, groupFailures, parseRecords, phpTrim, readCsvTable } from "./csv";

describe("CSV as the Laravel app's PHP read and wrote it", () => {
  it("reads quoted fields with delimiters, doubled quotes, backslashes and line breaks (fgetcsv)", () => {
    expect(parseRecords('a,"b,c","say ""hi""","x\\"y",z\n"multi\nline",2\n', ",")).toEqual([
      ["a", "b,c", 'say "hi"', 'x\\"y', "z"],
      ["multi\nline", "2"],
    ]);
    // an empty line is fgetcsv's [null]; a trailing delimiter is one more empty field
    expect(parseRecords("a;\r\n\r\nb", ";")).toEqual([["a", ""], null, ["b"]]);
  });

  it("guesses `;` from the header, drops a byte-order mark, lowercases names and counts blank lines", () => {
    const { header, rows } = readCsvTable("﻿SKU; Branch ;Qty\nA-1; CB-001 ;5\n\nA-2;CB-002;\n", { branch: "branch_code" });

    expect(header).toEqual(["sku", "branch_code", "qty"]);
    expect(rows).toEqual([
      { line: 2, cells: { sku: "A-1", branch_code: "CB-001", qty: "5" } },
      { line: 4, cells: { sku: "A-2", branch_code: "CB-002", qty: "" } },
    ]);
  });

  it("refuses an empty file and missing columns with Laravel's words", () => {
    expect(() => readCsvTable("  \n")).toThrow(new CsvError("File CSV kosong."));
    // PHP's trim() keeps a byte-order mark, so such a file isn't empty
    expect(phpTrim("﻿ \n")).toBe("﻿");
    expect(() => assertColumns(["name"], ["sku", "branch_code"])).toThrow("Kolom wajib tidak ada di file: sku, branch_code.");
  });

  it("writes like fputcsv: quotes only when needed, a space counts, quotes doubled unless escaped", () => {
    expect(csvLine(["PRD-001", "Obat Bebas", 5000, null, 'say "hi"', "a\\\"b", ""])).toBe('PRD-001,"Obat Bebas",5000,,"say ""hi""","a\\"b",\n');
  });

  it("folds failures by message with ten row numbers at most", () => {
    const failed = Array.from({ length: 12 }, (_, index) => ({ row: index + 2, message: "Cabang tidak ditemukan" }));

    expect(groupFailures([...failed, { row: 20, message: "Kolom sku wajib diisi." }])).toEqual([
      { message: "Cabang tidak ditemukan", count: 12, rows: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], more: 2 },
      { message: "Kolom sku wajib diisi.", count: 1, rows: [20], more: 0 },
    ]);
  });
});
