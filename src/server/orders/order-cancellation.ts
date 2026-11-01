import { and, eq, isNull, sql } from "drizzle-orm";
import { coupons, db, orderItems, orders, type DbExecutor } from "@/db";
import { END_STATUSES } from "@/lib/order-status";
import { ORDER_MORPH_CLASS, receiveStock, type BatchManifest } from "@/server/inventory/stock-allocator";
import { updateOrder, type Order } from "./order-updates";

/**
 * Undoes an order's stock and marks it `dibatalkan` or `kedaluwarsa`, ported from
 * App\Support\OrderCancellation: the one place stock goes back to the exact batches
 * checkout took it from (`order_items.batches_consumed`), and the coupon stops counting
 * the order as a use.
 *
 * Callers: a customer cancelling before payment, DOKU reporting the payment session
 * expired, and later the expiry sweep (step 6) and staff (step 7).
 *
 * Unlike Laravel, the order row is locked and its status checked again first, so two
 * of these racing (a customer cancelling as DOKU's expiry arrives) can't return the
 * stock twice. `allowed` decides on the locked row; an order already cancelled or
 * expired is never cancelled again. Returns the updated order, or null if nothing changed.
 */
export async function cancelOrder(
  order: Pick<Order, "id">,
  status: "dibatalkan" | "kedaluwarsa",
  options: { executor?: DbExecutor; allowed?: (locked: Order) => boolean } = {},
): Promise<Order | null> {
  const { executor = db, allowed = () => true } = options;

  return executor.transaction(async (tx) => {
    const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).limit(1).for("update");

    if (!locked || (END_STATUSES as readonly string[]).includes(locked.status) || !allowed(locked)) {
      return null;
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, locked.id)).orderBy(orderItems.id);

    for (const item of items) {
      const manifest = item.batchesConsumed as BatchManifest | null;

      if (!manifest?.length || !item.productId) {
        continue;
      }

      await receiveStock({
        branchId: locked.branchId,
        productId: item.productId,
        manifest,
        type: "retur masuk",
        reference: { type: ORDER_MORPH_CLASS, id: locked.id },
        executor: tx,
      });
    }

    if (locked.couponId) {
      // a deleted coupon is left alone, as Eloquent's relation would have hidden it
      await tx
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} - 1`, updatedAt: new Date() })
        .where(and(eq(coupons.id, locked.couponId), isNull(coupons.deletedAt)));
    }

    return updateOrder(locked, { status, cancelledAt: new Date() }, tx);
  });
}
