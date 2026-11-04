import { and, asc, desc, isNotNull, isNull, or, sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * The parts of a Filament list query every resource shares: the search box, the
 * "Data yang dihapus" filter, and the order (a sortable column or the default sort,
 * then the key in the same direction so pages never overlap).
 */

/** Filament's search: every word must match one of the columns, case-insensitively. */
export function searchWords(search: string | null | undefined, columns: SQL[]): SQL | undefined {
  const words = (search ?? "")
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");

  if (!words.length) {
    return undefined;
  }

  return and(...words.map((word) => or(...columns.map((column) => sql`lower(${column}::text) like ${`%${word.toLowerCase()}%`}`))));
}

/** "Data yang dihapus": "" without (default), "1" with, "0" only deleted records. */
export function trashedCondition(column: AnyColumn, trashed: string | undefined): SQL | undefined {
  return trashed === "1" ? undefined : trashed === "0" ? isNotNull(column) : isNull(column);
}

export type SortState = { column: string; direction: "asc" | "desc" } | null;

/** `?sort=column:direction` (Filament's own parameter), only for the table's sortable columns. */
export function parseSort(value: string | string[] | undefined, sortable: readonly string[]): SortState {
  if (typeof value !== "string") {
    return null;
  }

  const [column, direction] = value.split(":");

  if (!sortable.includes(column)) {
    return null;
  }

  return { column, direction: direction === "desc" ? "desc" : "asc" };
}

/** ORDER BY the chosen column (or the default), then the key the same way. */
export function orderBy(sort: SortState, columns: Record<string, AnyColumn | SQL>, fallback: { column: AnyColumn | SQL; direction: "asc" | "desc" }, key: AnyColumn): SQL[] {
  const chosen = sort ? { column: columns[sort.column], direction: sort.direction } : fallback;
  const by = chosen.direction === "desc" ? desc : asc;

  return chosen.column === key ? [by(key)] : [by(chosen.column), by(key)];
}
