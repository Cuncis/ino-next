import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { branches, branchStocks, categories, db, orders, products } from "@/db";
import type { AdminLocale } from "@/lib/admin-i18n";
import { branchScope, type ScopedStaff } from "@/lib/branch-scope";
import { SHORT_MONTHS } from "@/lib/dates";

/**
 * The dashboard's two widgets, ported from App\Filament\Widgets: money collected per
 * branch per day, and every product's stock at every active branch. Branch staff see
 * only their own branch's orders and stock (BranchScope).
 */
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `YYYY-MM-DD` → Carbon's translatedFormat('d M Y') in the panel's language. */
export function shortDate(isoDate: string, locale: AdminLocale): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");

  return `${day} ${(locale === "en" ? EN_MONTHS : SHORT_MONTHS)[Number(month) - 1]} ${year}`;
}

/** Today in Jakarta, `YYYY-MM-DD`, shifted by whole days. */
export function jakartaDay(offsetDays = 0): string {
  return new Date(Date.now() + 7 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** The date range: the last 7 days by default ("dari" six days ago through today). */
export function reconciliationRange(dari: unknown, sampai: unknown): { dari: string; sampai: string } {
  return { dari: isDate(dari) ? dari : jakartaDay(-6), sampai: isDate(sampai) ? sampai : jakartaDay() };
}

/** Jakarta midnight of a day, as the instant the database's wall-clock timestamps compare with. */
const jakartaMidnight = (day: string) => new Date(`${day}T00:00:00+07:00`);

export async function dailyReconciliation(range: { dari: string; sampai: string }, staff: ScopedStaff) {
  const day = sql<string>`to_char(${orders.paidAt}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ branchId: orders.branchId, tanggal: day, jumlah: sql<string>`count(*)`, total: sql<string>`sum(${orders.grandTotal})` })
    .from(orders)
    .where(
      and(
        eq(orders.paymentStatus, "lunas"),
        isNotNull(orders.paidAt),
        gte(orders.paidAt, jakartaMidnight(range.dari)),
        // endOfDay(): through 23:59:59
        lte(orders.paidAt, new Date(jakartaMidnight(range.sampai).getTime() + 86_399_000)),
        isNull(orders.deletedAt),
        branchScope(orders.branchId, staff),
      ),
    )
    .groupBy(orders.branchId, day)
    .orderBy(desc(day), asc(orders.branchId));

  const names = new Map(
    (rows.length
      ? await db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(and(inArray(branches.id, [...new Set(rows.map((row) => row.branchId))]), isNull(branches.deletedAt)))
      : []
    ).map((branch) => [branch.id, branch.name]),
  );

  return rows.map((row) => ({ tanggal: row.tanggal, branch: names.get(row.branchId) ?? "—", jumlahPesanan: Number(row.jumlah), total: Number(row.total) }));
}

/** One row per product (by name), one cell per active branch: quantity, and low when at or under the reorder point. */
export async function stockMatrix(staff: ScopedStaff) {
  const activeBranches = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.status, "aktif"), isNull(branches.deletedAt)))
    .orderBy(asc(branches.name));
  const productRows = await db
    .select({ id: products.id, name: products.name, category: categories.name })
    .from(products)
    .leftJoin(categories, and(eq(categories.id, products.categoryId), isNull(categories.deletedAt)))
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.name));
  const stocks = activeBranches.length
    ? await db
        .select({ branchId: branchStocks.branchId, productId: branchStocks.productId, quantity: branchStocks.quantity, reorderPoint: branchStocks.reorderPoint })
        .from(branchStocks)
        .where(
          and(
            inArray(
              branchStocks.branchId,
              activeBranches.map((branch) => branch.id),
            ),
            branchScope(branchStocks.branchId, staff),
          ),
        )
    : [];
  const byKey = new Map(stocks.map((stock) => [`${stock.productId}:${stock.branchId}`, stock]));

  return {
    branches: activeBranches,
    rows: productRows.map((product) => ({
      productName: product.name,
      category: product.category,
      cells: activeBranches.map((branch) => {
        const stock = byKey.get(`${product.id}:${branch.id}`);

        return { quantity: stock?.quantity ?? 0, isLow: Boolean(stock && stock.reorderPoint > 0 && stock.quantity <= stock.reorderPoint) };
      }),
    })),
  };
}
