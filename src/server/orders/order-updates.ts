import { eq } from "drizzle-orm";
import { db, orders, type DbExecutor } from "@/db";
import { dispatch, type CustomerNotificationName } from "@/lib/queue";
import { auditLog } from "@/server/audit";
import { CUSTOMER_CHANNELS } from "@/server/notifications/customer";
import { activeBranchStaff, notifyStaff } from "@/server/notifications/staff";

export type Order = typeof orders.$inferSelect;

type OrderChanges = Partial<Omit<Order, "id" | "createdAt" | "updatedAt">>;

/** What Laravel stored in `auditable_type` (it has no morph map). */
const ORDER_MODEL = "App\\Models\\Order";

/**
 * Every change to an order goes through here, as Laravel's went through `$order->update()`
 * and so through App\Observers\OrderObserver, the one place order messages are sent from.
 * Run it inside `transaction()` from @/lib/queue, so its messages wait for the commit.
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

/**
 * OrderObserver::created(): the customer's confirmation, the branch's staff, and the audit
 * trail, whose actor is the staff member who entered the order (none at checkout).
 */
export async function orderCreated(order: Order, executor: DbExecutor = db, actorId: number | null = null): Promise<void> {
  await notifyCustomer(order, "OrderConfirmed");
  await notifyStaff(await activeBranchStaff(order.branchId, executor), "NewOrderAtBranch", order.id);
  await auditLog({
    action: "pesanan_dibuat",
    auditable: { type: ORDER_MODEL, id: order.id },
    newValues: { number: order.number, grand_total: order.grandTotal, fulfilment: order.fulfilment },
    branchId: order.branchId,
    userId: actorId,
    executor,
  });
}

/** OrderObserver::updated(): a message for a payment received, and for each status that has one. */
async function orderUpdated(before: Order, after: Order): Promise<void> {
  if (after.paymentStatus !== before.paymentStatus && after.paymentStatus === "lunas") {
    await notifyCustomer(after, "PaymentReceived");
  }

  if (after.status !== before.status) {
    const notification = STATUS_NOTIFICATIONS[after.status];

    if (notification) {
      await notifyCustomer(after, notification);
    }
  }
}

const STATUS_NOTIFICATIONS: Record<string, CustomerNotificationName | undefined> = {
  dikirim: "OrderShipped",
  "siap diambil": "OrderReadyForPickup",
  selesai: "OrderCompleted",
  dibatalkan: "OrderCancelled",
  kedaluwarsa: "OrderCancelled",
};

async function notifyCustomer(order: Order, notification: CustomerNotificationName): Promise<void> {
  for (const channel of CUSTOMER_CHANNELS[notification]) {
    await dispatch("notify-customer", { notification, orderId: order.id, customerId: order.customerId, channel });
  }
}
