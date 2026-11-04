import { and, eq } from "drizzle-orm";
import { branchStocks, db, inventoryMovements } from "@/db";
import { transaction } from "@/lib/queue";
import { InsufficientStockError, warnIfNewlyLow } from "./stock-allocator";

/**
 * A direct correction to a branch's stock count, not tied to a batch (stock-taking,
 * damage, returns). Ported from App\Support\Inventory\StockAdjuster: the movement has
 * no batch, and a removal may not take the count (not the available stock) below zero.
 */
export async function adjustStock(options: { branchId: number; productId: number; delta: number; type: string; userId?: number | null; note?: string | null }): Promise<void> {
  const { branchId, productId, delta, type, userId = null, note = null } = options;

  await transaction(db, async (tx) => {
    const now = new Date();
    let [stock] = await tx
      .select()
      .from(branchStocks)
      .where(and(eq(branchStocks.branchId, branchId), eq(branchStocks.productId, productId)))
      .limit(1)
      .for("update");

    if (!stock) {
      [stock] = await tx
        .insert(branchStocks)
        .values({ branchId, productId, quantity: 0, reservedQuantity: 0, reorderPoint: 0, isListed: true, createdAt: now, updatedAt: now })
        .returning();
    }

    const quantity = stock.quantity + delta;

    if (quantity < 0) {
      throw new InsufficientStockError(Math.abs(delta), stock.quantity);
    }

    const [after] = await tx.update(branchStocks).set({ quantity, updatedAt: now }).where(eq(branchStocks.id, stock.id)).returning();

    await warnIfNewlyLow(stock, after, tx);
    await tx.insert(inventoryMovements).values({ branchId, productId, type, quantity: delta, balanceAfter: quantity, note, userId, createdAt: now, updatedAt: now });
  });
}
