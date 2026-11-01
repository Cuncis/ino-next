import { and, asc, eq, gt, gte, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { db, inventoryBatches, orders, products, type DbExecutor } from "@/db";
import { cancelOrder } from "@/server/orders/order-cancellation";
import { updateOrder } from "@/server/orders/order-updates";
import { activeBranchStaff, notifyStaff } from "@/server/notifications/staff";

/**
 * The Laravel app's scheduled artisan commands (routes/console.php), run by the worker's
 * scheduler and by hand with `pnpm task <name>`. Each returns the lines the command
 * printed. Like Laravel's `withoutGlobalScopes()`, these see every branch. Each can run
 * inside a given transaction (the tests roll it back).
 */
export type TaskOutput = string[];

/** pesanan:kadaluwarsakan: an order unpaid when its 24-hour window ran out is expired, its stock returned. */
export async function expireUnpaidOrders(executor: DbExecutor = db): Promise<TaskOutput> {
  const due = await executor
    .select()
    .from(orders)
    .where(and(eq(orders.status, "menunggu pembayaran"), eq(orders.paymentStatus, "belum bayar"), isNotNull(orders.expiresAt), lt(orders.expiresAt, new Date())))
    .orderBy(asc(orders.id));
  const lines: TaskOutput = [];

  for (const order of due) {
    // checked again on the locked row: a payment may have arrived since the list was read
    await cancelOrder(order, "kedaluwarsa", { executor, allowed: (current) => current.status === "menunggu pembayaran" && current.paymentStatus === "belum bayar" });
    lines.push(`Kedaluwarsa: #${order.number}`);
  }

  return [...lines, `${due.length} pesanan kedaluwarsa diproses.`];
}

/** pesanan:kadaluwarsakan-pengambilan: a pickup nobody collected in 48 hours goes back on the shelf. */
export async function expireUnclaimedPickups(executor: DbExecutor = db): Promise<TaskOutput> {
  const due = await executor
    .select()
    .from(orders)
    .where(and(eq(orders.status, "siap diambil"), isNotNull(orders.pickupCodeExpiresAt), lt(orders.pickupCodeExpiresAt, new Date())))
    .orderBy(asc(orders.id));
  const lines: TaskOutput = [];

  for (const order of due) {
    await cancelOrder(order, "kedaluwarsa", { executor, allowed: (current) => current.status === "siap diambil" });
    lines.push(`Kedaluwarsa (tidak diambil): #${order.number}`);
  }

  return [...lines, `${due.length} pesanan ambil kedaluwarsa diproses.`];
}

const PICKUP_WARNING_HOURS = 6;

/** notifikasi:pengambilan-mendekati-batas: the branch hears once about a pickup within 6 hours of its deadline. */
export async function notifyApproachingPickupDeadlines(executor: DbExecutor = db): Promise<TaskOutput> {
  const now = new Date();
  const due = await executor
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "siap diambil"),
        isNull(orders.pickupReminderSentAt),
        isNotNull(orders.pickupCodeExpiresAt),
        gte(orders.pickupCodeExpiresAt, now),
        lte(orders.pickupCodeExpiresAt, new Date(now.getTime() + PICKUP_WARNING_HOURS * 3600_000)),
      ),
    )
    .orderBy(asc(orders.id));
  const lines: TaskOutput = [];

  for (const order of due) {
    await notifyStaff(await activeBranchStaff(order.branchId, executor), "PickupDeadlineApproaching", order.id);
    await updateOrder(order, { pickupReminderSentAt: new Date() }, executor);
    lines.push(`Diberitahukan: pesanan #${order.number}`);
  }

  return [...lines, `${due.length} pesanan mendekati batas ambil diberitahukan.`];
}

const EXPIRY_WARNING_DAYS = 30;

/** notifikasi:produk-kedaluwarsa: the branch hears once about each batch on a shelf expiring within 30 days. */
export async function notifyExpiringBatches(executor: DbExecutor = db): Promise<TaskOutput> {
  // `expires_at` is a date, compared with the current Jakarta date and time as Laravel did
  // (so a batch expiring today, at midnight, has already gone by)
  const due = await executor
    .select({ batch: inventoryBatches, productName: products.name })
    .from(inventoryBatches)
    .innerJoin(products, eq(products.id, inventoryBatches.productId))
    .where(
      and(
        gt(inventoryBatches.quantity, 0),
        isNull(inventoryBatches.expiryReminderSentAt),
        isNotNull(inventoryBatches.expiresAt),
        sql`${inventoryBatches.expiresAt} between localtimestamp(0) and localtimestamp(0) + make_interval(days => ${EXPIRY_WARNING_DAYS})`,
      ),
    )
    .orderBy(asc(inventoryBatches.id));
  const lines: TaskOutput = [];

  for (const { batch, productName } of due) {
    await notifyStaff(await activeBranchStaff(batch.branchId, executor), "ExpiringProduct", batch.id);
    await executor.update(inventoryBatches).set({ expiryReminderSentAt: new Date(), updatedAt: new Date() }).where(eq(inventoryBatches.id, batch.id));
    lines.push(`Diberitahukan: batch ${batch.batchNumber} (${productName})`);
  }

  return [...lines, `${due.length} batch mendekati kedaluwarsa diberitahukan.`];
}

/** The commands by their artisan names, with Laravel's schedule (routes/console.php). */
export const SCHEDULED_TASKS = {
  "pesanan:kadaluwarsakan": { run: () => expireUnpaidOrders(), cron: "*/5 * * * *" },
  "pesanan:kadaluwarsakan-pengambilan": { run: () => expireUnclaimedPickups(), cron: "*/5 * * * *" },
  "notifikasi:produk-kedaluwarsa": { run: () => notifyExpiringBatches(), cron: "0 0 * * *" },
  "notifikasi:pengambilan-mendekati-batas": { run: () => notifyApproachingPickupDeadlines(), cron: "0 * * * *" },
} as const;

export type ScheduledTaskName = keyof typeof SCHEDULED_TASKS;
