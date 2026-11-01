import { and, asc, eq, gt, sql } from "drizzle-orm";
import { branchStocks, db, inventoryBatches, inventoryMovements, type DbExecutor } from "@/db";

/**
 * Takes stock out of a branch, batch by batch. Ported from
 * App\Support\Inventory\StockAllocator::consume() (receive() comes with the admin panel).
 *
 * FEFO: the batch that expires soonest goes first, because leaving an old batch on the
 * shelf while a newer one sells means the old one expires there. Runs in a transaction
 * with the branch's stock row locked, so two sales can't both take stock that exists once.
 *
 * Queries have no branch scope: this is a trusted service and the caller has already
 * decided which branch is meant.
 */
export type BatchManifest = { batch_id: number; batch_number: string; expires_at: string; quantity: number }[];

/** A movement would take a branch's available stock below zero. Thrown before anything is written. */
export class InsufficientStockError extends Error {
  constructor(
    readonly requested: number,
    readonly available: number,
  ) {
    super(`Stok tidak cukup: diminta ${requested}, tersedia ${available}.`);
  }
}

/** What Laravel stored in `reference_type` (it has no morph map). */
export const ORDER_MORPH_CLASS = "App\\Models\\Order";

export async function consumeStock(options: {
  branch: { id: number; name: string };
  product: { id: number; name: string };
  quantity: number;
  type: string;
  reference?: { type: string; id: number };
  userId?: number | null;
  note?: string | null;
  executor?: DbExecutor;
}): Promise<BatchManifest> {
  const { branch, product, quantity, type, reference, userId = null, note = null, executor = db } = options;

  return executor.transaction(async (tx) => {
    const [stock] = await tx
      .select()
      .from(branchStocks)
      .where(and(eq(branchStocks.branchId, branch.id), eq(branchStocks.productId, product.id)))
      .limit(1)
      .for("update");

    const available = stock ? stock.quantity - stock.reservedQuantity : 0;

    if (available < quantity) {
      throw new InsufficientStockError(quantity, Math.max(available, 0));
    }

    const batches = await tx
      .select()
      .from(inventoryBatches)
      .where(and(eq(inventoryBatches.branchId, branch.id), eq(inventoryBatches.productId, product.id), gt(inventoryBatches.quantity, 0)))
      .orderBy(asc(inventoryBatches.expiresAt), asc(inventoryBatches.id))
      .for("update");

    if (batches.reduce((sum, batch) => sum + batch.quantity, 0) < quantity) {
      throw new Error(
        `Data stok ${product.name} di ${branch.name} tidak sinkron: ` +
          "ringkasan cabang menyatakan cukup, tapi batch fisiknya kurang. " +
          "Perlu stok opname sebelum transaksi ini bisa lanjut.",
      );
    }

    let remaining = quantity;
    let runningBalance = stock.quantity;
    const manifest: BatchManifest = [];
    const now = new Date();

    for (const batch of batches) {
      if (remaining <= 0) {
        break;
      }

      const take = Math.min(batch.quantity, remaining);

      await tx
        .update(inventoryBatches)
        .set({ quantity: sql`${inventoryBatches.quantity} - ${take}`, updatedAt: now })
        .where(eq(inventoryBatches.id, batch.id));
      remaining -= take;
      runningBalance -= take;

      manifest.push({ batch_id: batch.id, batch_number: batch.batchNumber, expires_at: batch.expiresAt, quantity: take });

      await tx.insert(inventoryMovements).values({
        branchId: branch.id,
        productId: product.id,
        inventoryBatchId: batch.id,
        type,
        quantity: -take,
        balanceAfter: runningBalance,
        referenceType: reference?.type ?? null,
        referenceId: reference?.id ?? null,
        note,
        userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await tx
      .update(branchStocks)
      .set({ quantity: sql`${branchStocks.quantity} - ${quantity}`, updatedAt: now })
      .where(eq(branchStocks.id, stock.id));

    return manifest;
  });
}
