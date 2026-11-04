import { and, asc, eq } from "drizzle-orm";
import { branchStocks, db, inventoryBatches, inventoryMovements } from "@/db";
import { transaction } from "@/lib/queue";
import { jakartaToday, warnIfNewlyLow } from "./stock-allocator";

/**
 * Makes a branch's batches of one product match a counted list exactly. Ported from
 * App\Support\Inventory\StockReplacer (stock-taking from a spreadsheet).
 *
 * Batches in the list get the listed quantity and expiry; batches the branch holds that
 * aren't in the list go to zero (kept, so their history stays readable). Every change is
 * a `penyesuaian` movement. Stock already reserved for orders is never undercut: a count
 * below it is refused.
 */
export type CountedBatch = { batch_number: string; expires_at: string; quantity: number; cost_price?: number | null };

export class StockReplaceError extends Error {}

export async function replaceStock(options: {
  branchId: number;
  productId: number;
  batches: CountedBatch[];
  settings?: { is_listed?: boolean };
  userId?: number | null;
  note?: string | null;
}): Promise<{ batches: number; zeroed: number }> {
  const { branchId, productId, batches, settings = {}, userId = null, note = null } = options;

  return transaction(db, async (tx) => {
    const now = new Date();
    const where = and(eq(branchStocks.branchId, branchId), eq(branchStocks.productId, productId));
    let [stock] = await tx.select().from(branchStocks).where(where).limit(1).for("update");

    if (!stock) {
      [stock] = await tx
        .insert(branchStocks)
        .values({ branchId, productId, quantity: 0, reservedQuantity: 0, reorderPoint: 0, isListed: true, createdAt: now, updatedAt: now })
        .returning();
    }

    const newTotal = batches.reduce((sum, entry) => sum + entry.quantity, 0);

    if (newTotal < stock.reservedQuantity) {
      throw new StockReplaceError(`Jumlah baru ${newTotal} lebih kecil dari stok yang sedang dipesan (${stock.reservedQuantity}).`);
    }

    const rows = await tx
      .select()
      .from(inventoryBatches)
      .where(and(eq(inventoryBatches.branchId, branchId), eq(inventoryBatches.productId, productId)))
      .orderBy(asc(inventoryBatches.id))
      .for("update");
    // keyed by lowercase batch number, a later row winning (Collection::keyBy)
    const existing = new Map(rows.map((row) => [row.batchNumber.toLowerCase(), row]));
    let running = rows.reduce((sum, row) => sum + row.quantity, 0);
    let zeroed = 0;

    const record = async (batchId: number, delta: number) => {
      if (delta === 0) {
        return;
      }

      await tx.insert(inventoryMovements).values({
        branchId,
        productId,
        inventoryBatchId: batchId,
        type: "penyesuaian",
        quantity: delta,
        balanceAfter: running,
        note,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    };

    for (const entry of batches) {
      const key = entry.batch_number.toLowerCase();
      const batch = existing.get(key);

      existing.delete(key);

      if (batch) {
        const next = {
          expiresAt: entry.expires_at,
          costPrice: entry.cost_price ?? batch.costPrice,
          receivedAt: batch.receivedAt ?? jakartaToday(now),
          quantity: entry.quantity,
        };
        // Eloquent only writes (and touches updated_at) when something changed
        const dirty = next.expiresAt !== batch.expiresAt || next.costPrice !== batch.costPrice || next.receivedAt !== batch.receivedAt || next.quantity !== batch.quantity;

        if (dirty) {
          await tx
            .update(inventoryBatches)
            .set({ ...next, updatedAt: now })
            .where(eq(inventoryBatches.id, batch.id));
        }

        running += entry.quantity - batch.quantity;
        await record(batch.id, entry.quantity - batch.quantity);
      } else {
        const [created] = await tx
          .insert(inventoryBatches)
          .values({
            branchId,
            productId,
            batchNumber: entry.batch_number,
            expiresAt: entry.expires_at,
            costPrice: entry.cost_price ?? null,
            receivedAt: jakartaToday(now),
            quantity: entry.quantity,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        running += entry.quantity;
        await record(created.id, entry.quantity);
      }
    }

    for (const batch of existing.values()) {
      if (batch.quantity === 0) {
        continue;
      }

      await tx.update(inventoryBatches).set({ quantity: 0, updatedAt: now }).where(eq(inventoryBatches.id, batch.id));
      running -= batch.quantity;
      zeroed++;
      await record(batch.id, -batch.quantity);
    }

    const next = { quantity: newTotal, ...(settings.is_listed === undefined ? {} : { isListed: settings.is_listed }) };

    if (next.quantity !== stock.quantity || (next.isListed !== undefined && next.isListed !== stock.isListed)) {
      const [after] = await tx
        .update(branchStocks)
        .set({ ...next, updatedAt: now })
        .where(eq(branchStocks.id, stock.id))
        .returning();

      await warnIfNewlyLow(stock, after, tx);
    }

    return { batches: batches.length, zeroed };
  });
}
