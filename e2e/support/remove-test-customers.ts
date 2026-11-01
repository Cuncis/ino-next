import { and, eq, inArray, like, sql } from "drizzle-orm";
import { branchStocks, cartItems, carts, customerAddresses, customers, db, inventoryBatches, inventoryMovements, orderItems, orders, payments, shipments } from "../../src/db";

/**
 * Removes test accounts and everything their orders did: stock goes back into the very
 * batches it was taken from, and the orders, their stock movements, payments, shipments,
 * the cart and the addresses are deleted.
 */
export async function removeTestCustomers(emailPattern: string): Promise<void> {
  const found = await db.select({ id: customers.id }).from(customers).where(like(customers.email, emailPattern));
  const customerIds = found.map((customer) => customer.id);

  if (customerIds.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    const placed = await tx.select().from(orders).where(inArray(orders.customerId, customerIds));

    for (const order of placed) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));

      for (const item of items) {
        const manifest = (item.batchesConsumed ?? []) as { batch_id: number; quantity: number }[];
        const taken = manifest.reduce((sum, entry) => sum + entry.quantity, 0);

        for (const entry of manifest) {
          await tx
            .update(inventoryBatches)
            .set({ quantity: sql`${inventoryBatches.quantity} + ${entry.quantity}` })
            .where(eq(inventoryBatches.id, entry.batch_id));
        }

        if (taken > 0 && item.productId !== null) {
          await tx
            .update(branchStocks)
            .set({ quantity: sql`${branchStocks.quantity} + ${taken}` })
            .where(and(eq(branchStocks.branchId, order.branchId), eq(branchStocks.productId, item.productId)));
        }
      }

      await tx.delete(inventoryMovements).where(and(like(inventoryMovements.referenceType, "%Order"), eq(inventoryMovements.referenceId, order.id)));
      await tx.delete(payments).where(eq(payments.orderId, order.id));
      await tx.delete(shipments).where(eq(shipments.orderId, order.id));
      await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
      await tx.delete(orders).where(eq(orders.id, order.id));
    }

    const ownCarts = await tx.select({ id: carts.id }).from(carts).where(inArray(carts.customerId, customerIds));

    if (ownCarts.length) {
      await tx.delete(cartItems).where(inArray(cartItems.cartId, ownCarts.map((cart) => cart.id)));
      await tx.delete(carts).where(inArray(carts.customerId, customerIds));
    }

    await tx.delete(customerAddresses).where(inArray(customerAddresses.customerId, customerIds));
    await tx.delete(customers).where(inArray(customers.id, customerIds));
  });
}
