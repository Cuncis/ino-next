import { and, eq, isNull } from "drizzle-orm";
import { branches, db, products } from "@/db";
import { wantsJson } from "@/lib/http";
import type { Branch, Product } from "./cart";

/**
 * Lookups shared by the cart's Route Handlers (Shop\CartController's findProduct() and
 * findBranch()): products by SKU, branches by code. Soft-deleted rows are not found.
 */
export async function activeProductBySku(sku: string): Promise<Product | null> {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.sku, sku), eq(products.status, "aktif"), isNull(products.deletedAt)))
    .limit(1);

  return product ?? null;
}

export async function branchByCode(code: string): Promise<Branch | null> {
  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.code, code), isNull(branches.deletedAt)))
    .limit(1);

  return branch ?? null;
}

/** Laravel's abort(404, $message). */
export function notFoundResponse(request: Request, message: string): Response {
  return wantsJson(request) ? Response.json({ message }, { status: 404 }) : new Response(message, { status: 404 });
}
