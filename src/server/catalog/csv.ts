/**
 * CSV in and out the way the Laravel app's PHP did it, so a file exported by either app
 * imports into both, and line numbers in error reports match.
 *
 * Reading (App\Support\CsvTemplates\CsvTable): Excel in an Indonesian locale saves with
 * `;`, and may add a UTF-8 byte-order mark, so the delimiter is guessed from the header
 * line and the mark dropped. Header names are matched case-insensitively. A blank line is
 * skipped but still counted.
 *
 * Writing: PHP's fputcsv() with `\` as the escape character, after a byte-order mark so
 * Excel reads accented text correctly.
 */
export class CsvError extends Error {}

/** PHP's trim(): spaces, tabs, line breaks, NUL and vertical tab only (not a BOM or a non-breaking space). */
export function phpTrim(value: string): string {
  return value.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, "");
}

export type CsvRow = { line: number; cells: Record<string, string> };

/** One record per call, like fgetcsv(): quoted fields may hold the delimiter, quotes ("") and line breaks. */
export function parseRecords(content: string, delimiter: string): (string[] | null)[] {
  const records: (string[] | null)[] = [];
  let index = 0;

  while (index < content.length) {
    // a line with nothing on it is fgetcsv's [null]
    if (content[index] === "\n" || content[index] === "\r") {
      records.push(null);
      index += content[index] === "\r" && content[index + 1] === "\n" ? 2 : 1;
      continue;
    }

    const fields: string[] = [];
    let field = "";
    let ended = false;

    while (!ended) {
      // leading spaces before a quote are dropped by PHP
      let probe = index;

      while (content[probe] === " " || content[probe] === "\t") probe++;

      if (content[probe] === '"') {
        index = probe + 1;

        let escaped = false;

        for (;;) {
          if (index >= content.length) {
            break;
          }

          const character = content[index];

          if (escaped) {
            field += character;
            escaped = false;
            index++;
          } else if (character === "\\") {
            field += character;
            escaped = true;
            index++;
          } else if (character === '"') {
            if (content[index + 1] === '"') {
              field += '"';
              index += 2;
            } else {
              index++;
              break;
            }
          } else {
            field += character;
            index++;
          }
        }

        // anything after the closing quote, up to the delimiter, is kept as it is
        while (index < content.length && content[index] !== delimiter && content[index] !== "\n" && content[index] !== "\r") {
          field += content[index++];
        }
      } else {
        while (index < content.length && content[index] !== delimiter && content[index] !== "\n" && content[index] !== "\r") {
          field += content[index++];
        }
      }

      fields.push(field);
      field = "";

      if (index >= content.length) {
        ended = true;
      } else if (content[index] === delimiter) {
        index++;

        if (index >= content.length) {
          fields.push("");
          ended = true;
        }
      } else {
        index += content[index] === "\r" && content[index + 1] === "\n" ? 2 : 1;
        ended = true;
      }
    }

    records.push(fields);
  }

  return records;
}

/** CsvTable::read(): header-keyed rows, every cell trimmed. */
export function readCsvTable(content: string, aliases: Record<string, string> = {}): { header: string[]; rows: CsvRow[] } {
  if (phpTrim(content) === "") {
    throw new CsvError("File CSV kosong.");
  }

  const text = content.replace(/^﻿/, "");
  const firstLine = text.split("\n", 1)[0];
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const [headerRecord, ...records] = parseRecords(text, delimiter);
  const header = (headerRecord ?? []).map((name) => {
    const key = phpTrim(name).toLowerCase();

    return aliases[key] ?? key;
  });
  const rows: CsvRow[] = [];
  let line = 1;

  for (const record of records) {
    line++;

    if (record === null) {
      continue;
    }

    rows.push({ line, cells: Object.fromEntries(header.map((name, position) => [name, phpTrim(record[position] ?? "")])) });
  }

  return { header, rows };
}

/** CsvTable::assertColumns(). */
export function assertColumns(header: string[], required: readonly string[]): void {
  const missing = required.filter((column) => !header.includes(column));

  if (missing.length) {
    throw new CsvError(`Kolom wajib tidak ada di file: ${missing.join(", ")}.`);
  }
}

/** fputcsv(): a field is quoted when it holds the delimiter, a quote, a backslash, a space or a line break. */
export function csvLine(values: (string | number | null | undefined)[]): string {
  return (
    values
      .map((value) => {
        const field = value === null || value === undefined ? "" : String(value);

        if (!/[,"\\\n\r\t ]/.test(field)) {
          return field;
        }

        let quoted = "";
        let escaped = false;

        for (const character of field) {
          if (character === "\\") {
            escaped = true;
          } else if (!escaped && character === '"') {
            quoted += '"';
          } else {
            escaped = false;
          }

          quoted += character;
        }

        return `"${quoted}"`;
      })
      .join(",") + "\n"
  );
}

export const CSV_BOM = "﻿";

/** ImportFailures::group(): one cause hitting many rows shows once, with up to ten row numbers. */
export type ImportFailure = { row: number; message: string };

export function groupFailures(failed: ImportFailure[]): { message: string; count: number; rows: number[]; more: number }[] {
  const groups = new Map<string, number[]>();

  for (const failure of failed) {
    groups.set(failure.message, [...(groups.get(failure.message) ?? []), failure.row]);
  }

  return [...groups.entries()].map(([message, rows]) => ({ message, count: rows.length, rows: rows.slice(0, 10), more: Math.max(0, rows.length - 10) }));
}
