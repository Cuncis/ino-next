import { eq } from "drizzle-orm";
import { db, orders, type DbExecutor } from "@/db";

export type Order = typeof orders.$inferSelect;

type OrderChanges = Partial<Omit<Order, "id" | "createdAt" | "updatedAt">>;

/**
 * Every change to an order's status or payment goes through here, as Laravel's went
 * through `$order->update()` and so through App\Observers\OrderObserver. The observer's
 * customer messages (payment received, shipped, ready for pickup, completed, cancelled)
 * are sent from `orderUpdated()` once notifications are ported (step 6).
 */
export async function updateOrder(order: Order, changes: OrderChanges, executor: DbExecutor = db): Promise<Order> {
  const [updated] = await executor
    .update(orders)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(orders.id, order.id))
    .returning();

  await orderUpdated(order, updated);

  return updated;
}

/** OrderObserver::updated(): what changed between `before` and `after`. Nothing is sent yet (step 6). */
async function orderUpdated(before: Order, after: Order): Promise<void> {
  void before;
  void after;
}
