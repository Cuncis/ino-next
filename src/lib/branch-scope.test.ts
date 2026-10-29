import { and, count, eq, isNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { customers, db, orders, stockTransfers } from "@/db";
import { branchScope, customerBranchScope, transferBranchScope } from "./branch-scope";

afterAll(() => db.$client.end());

async function countOrders(where?: ReturnType<typeof branchScope>) {
  const [row] = await db.select({ n: count() }).from(orders).where(where);

  return row.n;
}

describe("branch scopes", () => {
  it("filter nothing for central staff or when no staff member is signed in", async () => {
    const all = await countOrders();

    expect(await countOrders(branchScope(orders.branchId, { branchId: null }))).toBe(all);
    expect(await countOrders(branchScope(orders.branchId, null))).toBe(all);
    expect(transferBranchScope(undefined)).toBeUndefined();
    expect(customerBranchScope({ branchId: null })).toBeUndefined();
  });

  it("confine orders to the staff member's branch", async () => {
    const [first] = await db.select({ branchId: orders.branchId }).from(orders).limit(1);
    const [expected] = await db.select({ n: count() }).from(orders).where(eq(orders.branchId, first.branchId));

    expect(await countOrders(branchScope(orders.branchId, { branchId: first.branchId }))).toBe(expected.n);
  });

  it("show branch staff the customers who ordered there, ignoring deleted orders", async () => {
    const [first] = await db.select({ branchId: orders.branchId }).from(orders).where(isNull(orders.deletedAt)).limit(1);
    const expected = await db
      .selectDistinct({ id: orders.customerId })
      .from(orders)
      .where(and(eq(orders.branchId, first.branchId), isNull(orders.deletedAt)));
    const [scoped] = await db.select({ n: count() }).from(customers).where(customerBranchScope({ branchId: first.branchId }));

    expect(scoped.n).toBe(expected.length);
  });

  it("show a transfer to both branches it touches", () => {
    const query = db.select({ id: stockTransfers.id }).from(stockTransfers).where(transferBranchScope({ branchId: 7 })).toSQL();

    expect(query.sql).toContain('(("stock_transfers"."from_branch_id" = $1) or ("stock_transfers"."to_branch_id" = $2))');
    expect(query.params).toEqual([7, 7]);
  });
});
