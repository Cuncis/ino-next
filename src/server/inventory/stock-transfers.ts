import { eq } from "drizzle-orm";
import { branches, db, products, stockTransfers } from "@/db";
import { transaction } from "@/lib/queue";
import { consumeStock, receiveStock, type BatchManifest } from "./stock-allocator";

/**
 * A stock transfer's life, diminta → dikirim → diterima (or dibatalkan before it ships).
 * Ported from App\Support\Inventory\StockTransferManager: shipping picks the origin's
 * batches soonest-expiring first and writes them onto the transfer, so receiving
 * recreates the same batches, expiry dates included, at the destination.
 */
export type StockTransfer = typeof stockTransfers.$inferSelect;

export const TRANSFER_MORPH_CLASS = "App\\Models\\StockTransfer";

export class TransferError extends Error {}

export const canBeShipped = (transfer: Pick<StockTransfer, "status">) => transfer.status === "diminta";
export const canBeReceived = (transfer: Pick<StockTransfer, "status">) => transfer.status === "dikirim";
export const canBeCancelled = (transfer: Pick<StockTransfer, "status">) => transfer.status === "diminta";

async function branchName(id: number): Promise<string> {
  // a closed (deleted) branch still names the other side of its transfers
  const [branch] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, id)).limit(1);

  return branch?.name ?? "";
}

export async function shipTransfer(transfer: StockTransfer, userId: number | null): Promise<StockTransfer> {
  if (!canBeShipped(transfer)) {
    throw new TransferError(`Transfer ${transfer.code} sudah diproses dan tidak bisa dikirim ulang.`);
  }

  const [product] = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, transfer.productId)).limit(1);
  const from = { id: transfer.fromBranchId, name: await branchName(transfer.fromBranchId) };
  const toName = await branchName(transfer.toBranchId);

  return transaction(db, async (tx) => {
    const manifest = await consumeStock({
      branch: from,
      product,
      quantity: transfer.quantity,
      type: "transfer keluar",
      reference: { type: TRANSFER_MORPH_CLASS, id: transfer.id },
      userId,
      note: `Transfer ${transfer.code} ke ${toName}`,
      executor: tx,
    });
    const [updated] = await tx
      .update(stockTransfers)
      .set({ status: "dikirim", batchesShipped: manifest, shippedAt: new Date(), updatedAt: new Date() })
      .where(eq(stockTransfers.id, transfer.id))
      .returning();

    return updated;
  });
}

export async function receiveTransfer(transfer: StockTransfer, userId: number | null): Promise<StockTransfer> {
  if (!canBeReceived(transfer)) {
    throw new TransferError(`Transfer ${transfer.code} belum dikirim atau sudah diterima.`);
  }

  const fromName = await branchName(transfer.fromBranchId);

  return transaction(db, async (tx) => {
    await receiveStock({
      branchId: transfer.toBranchId,
      productId: transfer.productId,
      manifest: ((transfer.batchesShipped ?? []) as BatchManifest).map(({ batch_number, expires_at, quantity }) => ({ batch_number, expires_at, quantity })),
      type: "transfer masuk",
      reference: { type: TRANSFER_MORPH_CLASS, id: transfer.id },
      userId,
      note: `Transfer ${transfer.code} dari ${fromName}`,
      executor: tx,
    });
    const [updated] = await tx.update(stockTransfers).set({ status: "diterima", receivedAt: new Date(), updatedAt: new Date() }).where(eq(stockTransfers.id, transfer.id)).returning();

    return updated;
  });
}

export async function cancelTransfer(transfer: StockTransfer): Promise<StockTransfer> {
  if (!canBeCancelled(transfer)) {
    throw new TransferError(`Transfer ${transfer.code} sudah dikirim dan tidak bisa dibatalkan.`);
  }

  const [updated] = await db.update(stockTransfers).set({ status: "dibatalkan", cancelledAt: new Date(), updatedAt: new Date() }).where(eq(stockTransfers.id, transfer.id)).returning();

  return updated;
}
