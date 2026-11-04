import { and, asc, count, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { branches, branchStocks, customers, db, orderItems, orders, payments, products, stockTransfers, users } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { branchScope, transferBranchScope, type ScopedStaff } from "@/lib/branch-scope";
import type { FiColor } from "@/components/admin/filament/ui";
import type { ResourcePermissions } from "@/lib/permissions";
import { addError, validate, type ValidationErrors } from "@/lib/validation";
import { auditLog } from "@/server/audit";
import { updateOrder } from "@/server/orders/order-updates";
import { orderBy, searchWords } from "./list-query";
import type { Staff } from "./staff-auth";

/**
 * Transfer (StockTransferResource), Faktur (InvoiceResource: an order read as an
 * invoice) and Rekonsiliasi (ReconciliationResource: the payment log with a daily
 * total per branch).
 */
const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/* ---------------- Transfer ---------------- */

export const TRANSFER_PERMISSIONS: ResourcePermissions = { viewAny: "Inventaris:Lihat", create: "Inventaris:Sesuaikan Stok" };

export function transferStatusColor(status: string): FiColor {
  return status === "diterima" ? "success" : status === "dikirim" ? "info" : status === "dibatalkan" ? "danger" : "warning";
}

const branchNameOf = (column: typeof stockTransfers.fromBranchId) => sql<string | null>`(select ${branches.name} from ${branches} where ${branches.id} = ${column} and ${branches.deletedAt} is null)`;
const productNameOf = sql<string | null>`(select ${products.name} from ${products} where ${products.id} = ${stockTransfers.productId} and ${products.deletedAt} is null)`;
const requesterOf = sql<string | null>`(select ${users.name} from ${users} where ${users.id} = ${stockTransfers.requestedBy} and ${users.deletedAt} is null)`;

/** The list: newest first, transfers touching the staff member's branch. */
export async function listTransfers(query: { search?: string; status?: string; page: number; perPage: number }, staff: ScopedStaff) {
  const where = and(transferBranchScope(staff), query.status ? eq(stockTransfers.status, query.status) : undefined, searchWords(query.search, [sql`${stockTransfers.code}`, productNameOf]));
  const [{ total }] = await db.select({ total: count() }).from(stockTransfers).where(where);
  const rows = await db
    .select({ transfer: stockTransfers, fromName: branchNameOf(stockTransfers.fromBranchId), toName: branchNameOf(stockTransfers.toBranchId), productName: productNameOf, requestedByName: requesterOf })
    .from(stockTransfers)
    .where(where)
    .orderBy(...orderBy(null, {}, { column: stockTransfers.createdAt, direction: "desc" }, stockTransfers.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.transfer, fromName: row.fromName, toName: row.toName, productName: row.productName, requestedByName: row.requestedByName })) };
}

export async function findTransfer(id: number, staff: ScopedStaff) {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db
    .select({ transfer: stockTransfers, fromName: branchNameOf(stockTransfers.fromBranchId), toName: branchNameOf(stockTransfers.toBranchId), productName: productNameOf, requestedByName: requesterOf })
    .from(stockTransfers)
    .where(and(eq(stockTransfers.id, id), transferBranchScope(staff)))
    .limit(1);

  return row ? { ...row.transfer, fromName: row.fromName, toName: row.toName, productName: row.productName, requestedByName: row.requestedByName } : null;
}

/** The form's choices: branches and products (not deleted), by name. */
export async function transferFormOptions() {
  const [branchRows, productRows] = await Promise.all([
    db.select({ id: branches.id, name: branches.name }).from(branches).where(isNull(branches.deletedAt)).orderBy(asc(branches.name)),
    db.select({ id: products.id, name: products.name }).from(products).where(isNull(products.deletedAt)).orderBy(asc(products.name)),
  ]);

  return { branches: branchRows.map((row) => ({ value: String(row.id), label: row.name })), products: productRows.map((row) => ({ value: String(row.id), label: row.name })) };
}

/**
 * CreateStockTransfer: the form's rules, then a "diminta" transfer coded TRF-001 onwards.
 * The code counts only the transfers the staff member can see, as Laravel's scoped query did.
 */
export async function createTransfer(body: Record<string, unknown>, staff: Staff, locale: AdminLocale): Promise<{ errors: ValidationErrors } | { errors: null; id: number }> {
  const t = (text: string) => lcfirst(translate(locale, text));
  const attributes = { from_branch_id: t("Cabang Asal"), to_branch_id: t("Cabang Tujuan"), product_id: t("Produk"), quantity: t("Jumlah"), note: t("Catatan") };
  let { errors } = validate<Record<string, unknown>>(
    body,
    {
      from_branch_id: ["required"],
      to_branch_id: ["required", "different:from_branch_id"],
      product_id: ["required"],
      quantity: ["required", "numeric", "integer", "min:1", "max:100000"],
      note: ["nullable", "max:255"],
    },
    { "to_branch_id.different": translate(locale, "Cabang tujuan harus berbeda dari cabang asal.") },
    attributes,
    locale,
  );
  const options = await transferFormOptions();
  const pickFails = (field: "from_branch_id" | "to_branch_id" | "product_id", choices: { value: string }[]) => {
    const value = body[field];

    if (value !== undefined && value !== null && value !== "" && !choices.some((choice) => choice.value === String(value))) {
      errors = addError(errors, field, locale === "en" ? `The selected ${attributes[field]} is invalid.` : `Kolom ${attributes[field]} yang dipilih tidak valid.`);
    }
  };

  pickFails("from_branch_id", options.branches);

  // the origin rule (not translated in Laravel either)
  if (body.from_branch_id !== undefined && body.from_branch_id !== "" && staff.branchId !== null && staff.branchId !== Number(body.from_branch_id)) {
    errors = addError(errors, "from_branch_id", "Anda hanya bisa meminta transfer dari cabang Anda sendiri.");
  }

  pickFails("to_branch_id", options.branches);
  pickFails("product_id", options.products);

  // enough available stock at the origin, when both are chosen
  if (!errors?.quantity && body.from_branch_id && body.product_id) {
    const [stock] = await db
      .select({ quantity: branchStocks.quantity, reserved: branchStocks.reservedQuantity })
      .from(branchStocks)
      .where(and(eq(branchStocks.branchId, Number(body.from_branch_id)), eq(branchStocks.productId, Number(body.product_id)), branchScope(branchStocks.branchId, staff)))
      .limit(1);
    const available = stock ? stock.quantity - stock.reserved : 0;

    if (available < Number(body.quantity)) {
      errors = addError(errors, "quantity", translate(locale, "Stok di cabang asal hanya tersisa :available.", { available }));
    }
  }

  if (errors) {
    return { errors };
  }

  const visible = await db.select({ code: stockTransfers.code }).from(stockTransfers).where(transferBranchScope(staff));
  const highest = visible.reduce((max, { code }) => (code.startsWith("TRF-") ? Math.max(max, Number.parseInt(code.slice(4), 10) || 0) : max), 0);
  const now = new Date();
  const [transfer] = await db
    .insert(stockTransfers)
    .values({
      code: `TRF-${String(highest + 1).padStart(3, "0")}`,
      fromBranchId: Number(body.from_branch_id),
      toBranchId: Number(body.to_branch_id),
      productId: Number(body.product_id),
      quantity: Number(body.quantity),
      note: typeof body.note === "string" && body.note !== "" ? body.note : null,
      status: "diminta",
      requestedBy: staff.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return { errors: null, id: transfer.id };
}

/* ---------------- Faktur ---------------- */

/** InvoicesTable::status(): what the invoice says, in the panel's language. */
export function invoiceStatus(order: { paymentStatus: string; expiresAt: Date | null }): "Lunas" | "Refund" | "Jatuh Tempo" | "Belum Bayar" {
  if (order.paymentStatus === "lunas") return "Lunas";
  if (order.paymentStatus === "refund") return "Refund";
  if (order.expiresAt && order.expiresAt.getTime() < Date.now()) return "Jatuh Tempo";

  return "Belum Bayar";
}

export function invoiceStatusColor(status: ReturnType<typeof invoiceStatus>): FiColor {
  return status === "Lunas" ? "success" : status === "Refund" ? "gray" : status === "Jatuh Tempo" ? "danger" : "warning";
}

const customerNameOf = sql<string | null>`(select ${customers.name} from ${customers} where ${customers.id} = ${orders.customerId} and ${customers.deletedAt} is null)`;

export async function listInvoices(query: { search?: string; page: number; perPage: number }, staff: ScopedStaff) {
  const where = and(isNull(orders.deletedAt), branchScope(orders.branchId, staff), searchWords(query.search, [sql`${orders.number}`, customerNameOf]));
  const [{ total }] = await db.select({ total: count() }).from(orders).where(where);
  const rows = await db
    .select({ order: orders, customerName: customerNameOf })
    .from(orders)
    .where(where)
    .orderBy(...orderBy(null, {}, { column: orders.createdAt, direction: "desc" }, orders.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.order, customerName: row.customerName })) };
}

/** An invoice a staff member may open: an order of their branch that isn't deleted. */
export async function findInvoice(id: number, staff: ScopedStaff) {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db
    .select({ order: orders, customerName: customerNameOf, branchName: sql<string | null>`(select ${branches.name} from ${branches} where ${branches.id} = ${orders.branchId} and ${branches.deletedAt} is null)` })
    .from(orders)
    .where(and(eq(orders.id, id), isNull(orders.deletedAt), branchScope(orders.branchId, staff)))
    .limit(1);

  if (!row) {
    return null;
  }

  const [items, paymentRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.id)),
  ]);

  return { ...row.order, customerName: row.customerName, branchName: row.branchName, items, payments: paymentRows };
}

/**
 * "Catat Refund": records that money went back (DOKU's refund API is never called). The
 * latest payment is marked refunded with the note, the order "refund", and it is audited.
 */
export async function recordRefund(invoice: NonNullable<Awaited<ReturnType<typeof findInvoice>>>, note: string, staff: Staff): Promise<void> {
  const latest = [...invoice.payments].sort((a, b) => b.id - a.id)[0];

  if (latest) {
    await db.update(payments).set({ status: "refunded", refundedAt: new Date(), refundNote: note, updatedAt: new Date() }).where(eq(payments.id, latest.id));
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, invoice.id));

  await updateOrder(order, { paymentStatus: "refund" });
  await auditLog({
    action: "faktur.refund",
    auditable: { type: "App\\Models\\Order", id: invoice.id },
    oldValues: { payment_status: "lunas" },
    newValues: { payment_status: "refund", note },
    userId: staff.id,
    branchId: invoice.branchId,
  });
}

/* ---------------- Rekonsiliasi ---------------- */

export function paymentStatusColor(status: string): FiColor {
  return status === "success" ? "success" : status === "pending" ? "warning" : status === "refunded" ? "info" : "danger";
}

/**
 * The payment log, newest first. Payments themselves aren't confined to a branch (as in
 * Laravel), but their order is: for another branch's payment the order and branch show
 * empty, and the search by order number only finds the staff member's own.
 */
export async function listPayments(query: { search?: string; page: number; perPage: number }, staff: ScopedStaff) {
  const visibleOrder = and(eq(orders.id, payments.orderId), isNull(orders.deletedAt), branchScope(orders.branchId, staff));
  const orderNumber = sql<string | null>`(select ${orders.number} from ${orders} where ${visibleOrder})`;
  const branchName = sql<string | null>`(select ${branches.name} from ${orders} join ${branches} on ${branches.id} = ${orders.branchId} and ${branches.deletedAt} is null where ${visibleOrder})`;
  const where = searchWords(query.search, [orderNumber]);
  const [{ total }] = await db.select({ total: count() }).from(payments).where(where);
  const rows = await db
    .select({ payment: payments, orderNumber, branchName })
    .from(payments)
    .where(where)
    .orderBy(desc(payments.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.payment, orderNumber: row.orderNumber, branchName: row.branchName })) };
}

export async function findPayment(id: number) {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);

  return payment ?? null;
}

/** "Terkumpul per Cabang per Hari": paid orders of the staff member's branches, per branch and day, newest day first. */
export async function dailyCollections(from: string, to: string, staff: ScopedStaff) {
  const day = sql<string>`to_char(date(${orders.paidAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      branchName: sql<string | null>`(select ${branches.name} from ${branches} where ${branches.id} = ${orders.branchId} and ${branches.deletedAt} is null)`,
      day,
      orderCount: count(),
      total: sql<string>`sum(${orders.grandTotal})`,
    })
    .from(orders)
    .where(
      and(
        isNull(orders.deletedAt),
        branchScope(orders.branchId, staff),
        eq(orders.paymentStatus, "lunas"),
        sql`${orders.paidAt} is not null`,
        gte(orders.paidAt, new Date(`${from}T00:00:00+07:00`)),
        lte(orders.paidAt, new Date(`${to}T23:59:59+07:00`)),
      ),
    )
    .groupBy(orders.branchId, sql`date(${orders.paidAt})`)
    .orderBy(desc(sql`date(${orders.paidAt})`), asc(orders.branchId));

  return rows.map((row) => ({ branchName: row.branchName ?? "—", day: row.day, orderCount: Number(row.orderCount), total: Number(row.total) }));
}

/** Today and six days back, in Jakarta: the summary's default range. */
export function defaultRange(now = new Date()): { from: string; to: string } {
  const day = (date: Date) => new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

  return { from: day(new Date(now.getTime() - 6 * 86_400_000)), to: day(now) };
}
