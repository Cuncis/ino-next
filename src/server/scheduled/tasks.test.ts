import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { branches, branchStocks, customers, db, inventoryBatches, orderItems, orders, products, users, type DbExecutor } from "@/db";
import { withRollback } from "@/test/db";

// jobs run straight away and are only recorded: nothing is sent, and the rollback undoes every row
const jobs: { name: string; data: Record<string, unknown> }[] = [];

vi.mock("@/jobs/handlers", () => ({ handleJob: async (name: string, data: Record<string, unknown>) => void jobs.push({ name, data }) }));

process.env.QUEUE_CONNECTION = "sync";

const { consumeStock } = await import("@/server/inventory/stock-allocator");
const { expireUnclaimedPickups, expireUnpaidOrders, notifyApproachingPickupDeadlines, notifyExpiringBatches } = await import("./tasks");

const SKU = "ID109201-4";
const hours = (n: number) => new Date(Date.now() + n * 3600_000);

beforeEach(() => {
  jobs.length = 0;
});

afterAll(async () => {
  await db.$client.end();
});

/** A branch, a product in stock there, a customer and an active staff member of the branch. */
async function fixture(tx: DbExecutor) {
  const [{ branch, product }] = await tx
    .select({ branch: branches, product: products })
    .from(branchStocks)
    .innerJoin(branches, eq(branches.id, branchStocks.branchId))
    .innerJoin(products, eq(products.id, branchStocks.productId))
    .where(and(eq(products.sku, SKU), eq(branches.code, "CB-014")));
  const now = new Date();
  const [customer] = await tx
    .insert(customers)
    .values({ code: "ZZ-TASKS", name: "ZZ Tasks", email: "zz-tasks@example.com", password: "x", status: "aktif", createdAt: now, updatedAt: now })
    .returning();
  const [staff] = await tx
    .insert(users)
    .values({ name: "ZZ Staff", email: "zz-staff@example.com", password: "x", branchId: branch.id, isActive: true, createdAt: now, updatedAt: now })
    .returning();

  return { branch, product, customer, staff };
}

async function stockOf(tx: DbExecutor, branchId: number, productId: number) {
  const [stock] = await tx
    .select()
    .from(branchStocks)
    .where(and(eq(branchStocks.branchId, branchId), eq(branchStocks.productId, productId)));

  return stock;
}

/** An order holding one unit of the product, taken from its batches like a checkout does. */
async function placeOrder(tx: DbExecutor, f: Awaited<ReturnType<typeof fixture>>, number: string, values: Partial<typeof orders.$inferInsert>) {
  const now = new Date();
  const [order] = await tx
    .insert(orders)
    .values({ number, branchId: f.branch.id, customerId: f.customer.id, fulfilment: "ambil", paymentMethod: "online", grandTotal: 1000, createdAt: now, updatedAt: now, ...values })
    .returning();
  const manifest = await consumeStock({ branch: f.branch, product: f.product, quantity: 1, type: "penjualan", reference: { type: "App\\Models\\Order", id: order.id }, executor: tx });

  await tx.insert(orderItems).values({ orderId: order.id, productId: f.product.id, productName: f.product.name, sku: SKU, unitPrice: 1000, quantity: 1, lineTotal: 1000, batchesConsumed: manifest });

  return order;
}

const reload = async (tx: DbExecutor, id: number) => (await tx.select().from(orders).where(eq(orders.id, id)))[0];

describe("scheduled tasks", () => {
  it("pesanan:kadaluwarsakan expires an unpaid order past its window, returns its stock and tells the customer", async () => {
    await withRollback(async (tx) => {
      const f = await fixture(tx);
      const before = (await stockOf(tx, f.branch.id, f.product.id)).quantity;
      const due = await placeOrder(tx, f, "ZZ-TASK-UNPAID", { expiresAt: hours(-1) });
      const notDue = await placeOrder(tx, f, "ZZ-TASK-WAITING", { expiresAt: hours(1) });

      jobs.length = 0;

      const output = await expireUnpaidOrders(tx);

      expect(output).toContain("Kedaluwarsa: #ZZ-TASK-UNPAID");
      expect(output.at(-1)).toMatch(/^\d+ pesanan kedaluwarsa diproses\.$/);
      expect(await reload(tx, due.id)).toMatchObject({ status: "kedaluwarsa" });
      expect((await reload(tx, due.id)).cancelledAt).not.toBeNull();
      expect(await reload(tx, notDue.id)).toMatchObject({ status: "menunggu pembayaran" });
      expect((await stockOf(tx, f.branch.id, f.product.id)).quantity).toBe(before - 1);
      expect(jobs).toContainEqual({ name: "notify-customer", data: { notification: "OrderCancelled", orderId: due.id, customerId: f.customer.id, channel: "mail" } });
    });
  });

  it("warns the branch once about a pickup near its deadline, then expires it when nobody came", async () => {
    await withRollback(async (tx) => {
      const f = await fixture(tx);
      const order = await placeOrder(tx, f, "ZZ-TASK-PICKUP", { status: "siap diambil", paymentStatus: "lunas", pickupCode: "ZZ1234", pickupCodeExpiresAt: hours(3) });

      jobs.length = 0;
      expect(await notifyApproachingPickupDeadlines(tx)).toContain("Diberitahukan: pesanan #ZZ-TASK-PICKUP");
      expect(jobs).toEqual([{ name: "notify-staff", data: { notification: "PickupDeadlineApproaching", userId: f.staff.id, subjectId: order.id } }]);
      expect(await notifyApproachingPickupDeadlines(tx)).not.toContain("Diberitahukan: pesanan #ZZ-TASK-PICKUP");

      await tx.update(orders).set({ pickupCodeExpiresAt: hours(-1) }).where(eq(orders.id, order.id));
      jobs.length = 0;

      expect(await expireUnclaimedPickups(tx)).toContain("Kedaluwarsa (tidak diambil): #ZZ-TASK-PICKUP");
      expect(await reload(tx, order.id)).toMatchObject({ status: "kedaluwarsa", paymentStatus: "lunas" });
      expect(jobs.map((job) => job.data.notification)).toEqual(["OrderCancelled"]);
    });
  });

  it("warns the branch once about each batch expiring within 30 days", async () => {
    await withRollback(async (tx) => {
      const f = await fixture(tx);
      const inTenDays = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
      const [batch] = await tx
        .insert(inventoryBatches)
        .values({ branchId: f.branch.id, productId: f.product.id, batchNumber: "ZZ-BATCH", expiresAt: inTenDays, quantity: 5 })
        .returning();

      expect(await notifyExpiringBatches(tx)).toContain(`Diberitahukan: batch ZZ-BATCH (${f.product.name})`);
      expect(jobs).toContainEqual({ name: "notify-staff", data: { notification: "ExpiringProduct", userId: f.staff.id, subjectId: batch.id } });
      expect(await notifyExpiringBatches(tx)).toEqual(["0 batch mendekati kedaluwarsa diberitahukan."]);
    });
  });
});

describe("low stock", () => {
  it("tells the branch once, when a sale first takes a product to its reorder point", async () => {
    await withRollback(async (tx) => {
      const f = await fixture(tx);
      const stock = await stockOf(tx, f.branch.id, f.product.id);

      await tx.update(branchStocks).set({ reorderPoint: stock.quantity - 2 }).where(eq(branchStocks.id, stock.id));

      const sell = () => consumeStock({ branch: f.branch, product: f.product, quantity: 1, type: "penjualan", executor: tx });

      await sell();
      expect(jobs).toEqual([]);
      await sell();
      expect(jobs).toEqual([{ name: "notify-staff", data: { notification: "LowStock", userId: f.staff.id, subjectId: stock.id } }]);
      await sell();
      expect(jobs).toHaveLength(1);
    });
  });
});
