import { like } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db, type DbExecutor } from "@/db";

/**
 * Next human-readable code in a series: PRD-013, CUS-007, INO-2452.
 * Ported from App\Support\CodeSequence::next().
 *
 * Soft-deleted rows are included on purpose (Drizzle never hides them): a deleted
 * product still occupies its SKU as far as the unique index is concerned.
 *
 * @param prefix including the separator, e.g. 'PRD-'
 * @param pad zero-padding width; 0 leaves the number unpadded
 * @param floor number to continue from when the table is empty
 */
export async function nextCode(options: {
  table: PgTable;
  column: AnyPgColumn;
  prefix: string;
  pad?: number;
  floor?: number;
  executor?: DbExecutor;
}): Promise<string> {
  const { table, column, prefix, pad = 3, floor = 0, executor = db } = options;

  const rows = await executor
    .select({ code: column })
    .from(table)
    .where(like(column, `${escapeLike(prefix)}%`));

  const highest = rows.reduce((max, { code }) => Math.max(max, leadingInteger(String(code).slice(prefix.length))), 0);
  const next = Math.max(highest, floor) + 1;

  return prefix + (pad > 0 ? String(next).padStart(pad, "0") : String(next));
}

/**
 * The number at the start of a string, or 0 — PHP's `(int)` cast, which the Laravel
 * version relies on: customer order numbers like `INO-CB001-261029-ABCDE` share the
 * `INO-` prefix with hand-typed `INO-2452` and must count as 0, not break the series.
 */
function leadingInteger(value: string): number {
  const match = /^\s*([+-]?\d+)/.exec(value);

  return match ? Number.parseInt(match[1], 10) : 0;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
