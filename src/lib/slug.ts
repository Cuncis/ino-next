import { and, eq, ne } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db, type DbExecutor } from "@/db";

/** Letters that Unicode decomposition doesn't turn into ASCII, mapped the way Laravel's Str::ascii does. */
const TRANSLITERATIONS: Record<string, string> = {
  ß: "ss",
  ẞ: "SS",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
  ø: "o",
  Ø: "O",
  đ: "d",
  Đ: "D",
  ł: "l",
  Ł: "L",
  þ: "th",
  Þ: "TH",
  ð: "d",
  Ð: "D",
};

/**
 * URL slug, matching Laravel's Str::slug(): accents dropped (Café → cafe), `@` read
 * as "at", underscores as dashes, every other symbol removed, runs of spaces and
 * dashes collapsed. Text with no Latin letters or digits becomes "".
 */
export function slugify(value: string): string {
  const ascii = value
    .replace(/[ßẞæÆœŒøØđĐłŁþÞðÐ]/g, (letter) => TRANSLITERATIONS[letter])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

  return ascii
    .replace(/_/g, "-")
    .replace(/@/g, "-at-")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A slug that is free in a unique column: two products called "Vitamin C" get
 * `vitamin-c` and `vitamin-c-2`. Ported from App\Support\Slug::unique().
 *
 * Soft-deleted rows are included on purpose (Drizzle never hides them): a deleted
 * row still holds its slug against the unique index.
 */
export async function uniqueSlug(options: {
  table: PgTable;
  column: AnyPgColumn;
  value: string;
  idColumn?: AnyPgColumn;
  ignoreId?: number | null;
  executor?: DbExecutor;
}): Promise<string> {
  const { table, column, value, idColumn, ignoreId = null, executor = db } = options;
  const base = slugify(value);
  let candidate = base;
  let suffix = 2;

  while (await slugTaken(executor, table, column, candidate, idColumn, ignoreId)) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }

  return candidate;
}

async function slugTaken(
  executor: DbExecutor,
  table: PgTable,
  column: AnyPgColumn,
  value: string,
  idColumn: AnyPgColumn | undefined,
  ignoreId: number | null,
): Promise<boolean> {
  const conditions = [eq(column, value)];

  if (ignoreId !== null) {
    if (!idColumn) {
      throw new Error("uniqueSlug: pass idColumn together with ignoreId");
    }

    conditions.push(ne(idColumn, ignoreId));
  }

  const rows = await executor
    .select({ value: column })
    .from(table)
    .where(and(...conditions))
    .limit(1);

  return rows.length > 0;
}
