import { and, asc, eq, gt, sql } from "drizzle-orm";
import { branchStocks, db, inventoryBatches, inventoryMovements, type DbExecutor } from "@/db";

/**
 * Takes stock out of a branch, batch by batch. Ported from
 * App\Support\Inventory\StockAllocator: consume() takes it out, receive() puts it back.
 *
 * FEFO: the batch that expires soonest goes first, because leaving an old batch on the
 * shelf while a newer one sells means the old one expires there. Runs in a transaction
 * with the branch's stock row locked, so two sales can't both take stock that exists once.
 *
 * Queries have no branch scope: this is a trusted service and the caller has already
 * decided which branch is meant.
 */
export type BatchManifest = { batch_id: number; batch_number: string; expires_at: string; quantity: number }[];

/** What receive() takes: a sale's manifest, or a delivery with a cost price per batch. */
export type ReceiptManifest = { batch_number: string; expires_at: string; quantity: number; cost_price?: number | null }[];

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

/**
 * Puts stock into a branch, batch by batch: a return gives each unit back to the batch it
 * was taken from (the manifest consumeStock() wrote), and a missing batch is created.
 */
export async function receiveStock(options: {
  branchId: number;
  productId: number;
  manifest: ReceiptManifest;
  type: string;
  reference?: { type: string; id: number };
  userId?: number | null;
  note?: string | null;
  executor?: DbExecutor;
}): Promise<void> {
  const { branchId, productId, manifest, type, reference, userId = null, note = null, executor = db } = options;

  await executor.transaction(async (tx) => {
    const now = new Date();
    const where = and(eq(branchStocks.branchId, branchId), eq(branchStocks.productId, productId));
    let [stock] = await tx.select().from(branchStocks).where(where).limit(1).for("update");

    if (!stock) {
      [stock] = await tx
        .insert(branchStocks)
        .values({ branchId, productId, quantity: 0, reservedQuantity: 0, reorderPoint: 0, isListed: true, createdAt: now, updatedAt: now })
        .returning();
    }

    let total = 0;

    for (const entry of manifest) {
      const [batch] = await tx
        .select()
        .from(inventoryBatches)
        .where(and(eq(inventoryBatches.branchId, branchId), eq(inventoryBatches.productId, productId), eq(inventoryBatches.batchNumber, entry.batch_number)))
        .limit(1)
        .for("update");

      const [saved] = batch
        ? await tx
            .update(inventoryBatches)
            .set({
              expiresAt: entry.expires_at,
              costPrice: entry.cost_price ?? batch.costPrice,
              receivedAt: batch.receivedAt ?? jakartaToday(now),
              quantity: batch.quantity + entry.quantity,
              updatedAt: now,
            })
            .where(eq(inventoryBatches.id, batch.id))
            .returning()
        : await tx
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

      total += entry.quantity;

      await tx.insert(inventoryMovements).values({
        branchId,
        productId,
        inventoryBatchId: saved.id,
        type,
        quantity: entry.quantity,
        balanceAfter: stock.quantity + total,
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
      .set({ quantity: sql`${branchStocks.quantity} + ${total}`, updatedAt: now })
      .where(eq(branchStocks.id, stock.id));
  });
}

/** `received_at` is a date: today in Jakarta. */
function jakartaToday(now: Date): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
