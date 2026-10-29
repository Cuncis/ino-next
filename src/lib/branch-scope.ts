import { and, eq, exists, isNull, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { customers, db, orders, stockTransfers } from "@/db";

/**
 * Confines admin queries to the signed-in staff member's own branch. Ported from the
 * Laravel app's global scopes (App\Support\Auth\Scopes), which applied themselves
 * silently; Drizzle has no global scopes, so every admin query for a branch-scoped
 * table must add one of these to its `where`.
 *
 * Each returns `undefined` (no filter) for central staff (`branch_id` null) and when
 * there is no staff member at all — storefront requests, the worker, tests — exactly
 * like the Laravel scopes. Drizzle's `and()` skips `undefined`, so they compose:
 * `where(and(eq(orders.status, "dikirim"), branchScope(orders.branchId, staff)))`.
 *
 * Services that take an explicit branch (stock allocation, transfers) don't use these:
 * they act on whatever branch the caller authorized, including the other side of a transfer.
 */
export type ScopedStaff = { branchId: number | null } | null | undefined;

/**
 * Rows with a plain branch column: orders, branch_stocks, inventory_batches,
 * inventory_movements (Laravel's BranchScope).
 */
export function branchScope(column: AnyPgColumn, staff: ScopedStaff): SQL | undefined {
  if (!staff || staff.branchId === null) {
    return undefined;
  }

  return eq(column, staff.branchId);
}

/** A stock transfer belongs to both branches it touches, so either side sees it (TransferBranchScope). */
export function transferBranchScope(staff: ScopedStaff): SQL | undefined {
  if (!staff || staff.branchId === null) {
    return undefined;
  }

  return or(eq(stockTransfers.fromBranchId, staff.branchId), eq(stockTransfers.toBranchId, staff.branchId));
}

/**
 * A customer belongs to no branch, but branch staff see the customers who have ordered
 * there (CustomerBranchScope). Soft-deleted orders don't count, as in Laravel's whereHas.
 */
export function customerBranchScope(staff: ScopedStaff): SQL | undefined {
  if (!staff || staff.branchId === null) {
    return undefined;
  }

  return exists(
    db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.customerId, customers.id), eq(orders.branchId, staff.branchId), isNull(orders.deletedAt))),
  );
}
