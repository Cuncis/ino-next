import { and, asc, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { customerAddresses, customers, db, orders } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { CUSTOMER_STATUSES } from "@/lib/admin-options";
import { customerBranchScope } from "@/lib/branch-scope";
import { nextCode } from "@/lib/code-sequence";
import { hashLaravelPassword } from "@/lib/password";
import type { ResourcePermissions } from "@/lib/permissions";
import { randomString } from "@/lib/random";
import { addError, validate, type ValidationErrors } from "@/lib/validation";
import { searchWords, trashedCondition } from "./list-query";
import type { Staff } from "./staff-auth";

/**
 * Pelanggan (CustomerResource): the list with orders and spending, CreateCustomer and
 * EditCustomer. Branch staff see only the customers who ordered at their branch
 * (CustomerBranchScope), and count only those orders. A customer's city and address
 * live on their default address, which the form reads and writes.
 */
export const CUSTOMER_PERMISSIONS: ResourcePermissions = { viewAny: "Pelanggan:Lihat", create: "Pelanggan:Tambah", update: "Pelanggan:Ubah", delete: "Pelanggan:Hapus" };

export type Customer = typeof customers.$inferSelect;

type ScopedStaff = Pick<Staff, "branchId">;

/** The customer's orders as Laravel's `orders()` saw them: not deleted, and in the staff member's branch. */
const orderScope = (staff: ScopedStaff) => and(isNull(orders.deletedAt), staff.branchId === null ? undefined : eq(orders.branchId, staff.branchId));

export async function listCustomers(query: { search?: string; trashed?: string; page: number; perPage: number }, staff: ScopedStaff) {
  const where = and(
    trashedCondition(customers.deletedAt, query.trashed),
    customerBranchScope(staff),
    searchWords(query.search, [sql`${customers.code}`, sql`${customers.name}`, sql`${customers.phone}`]),
  );
  const [{ total }] = await db.select({ total: count() }).from(customers).where(where);
  const scope = orderScope(staff);
  const rows = await db
    .select({
      customer: customers,
      ordersCount: sql<string>`(select count(*) from ${orders} where ${orders.customerId} = ${customers.id} and ${scope})`,
      spent: sql<string | null>`(select sum(${orders.grandTotal}) from ${orders} where ${orders.customerId} = ${customers.id} and ${scope} and ${orders.status} not in ('dibatalkan', 'kedaluwarsa'))`,
    })
    .from(customers)
    .where(where)
    .orderBy(asc(customers.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);
  const cities = await defaultAddresses(rows.map((row) => row.customer.id));

  return {
    total,
    rows: rows.map((row) => ({ ...row.customer, ordersCount: Number(row.ordersCount), // withSum() is null without a counted order, and Filament shows nothing for it
      spent: row.spent === null ? null : Number(row.spent), city: cities.get(row.customer.id)?.kota ?? null })),
  };
}

/** Each customer's default address, or their first one: `firstWhere('is_default', true) ?? first()`. */
async function defaultAddresses(ids: number[]) {
  const found = new Map<number, typeof customerAddresses.$inferSelect>();

  if (!ids.length) {
    return found;
  }

  const rows = await db.select().from(customerAddresses).where(inArray(customerAddresses.customerId, ids)).orderBy(asc(customerAddresses.id));

  for (const row of rows) {
    const current = found.get(row.customerId);

    if (!current || (!current.isDefault && row.isDefault)) {
      found.set(row.customerId, row);
    }
  }

  return found;
}

/** A customer this staff member may open, deleted ones included (the edit page's route binding). */
export async function findCustomer(id: number, staff: ScopedStaff): Promise<Customer | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), customerBranchScope(staff)))
    .limit(1);

  return row ?? null;
}

export async function customerAddress(id: number) {
  return (await defaultAddresses([id])).get(id) ?? null;
}

export async function customerOrderCount(id: number, staff: ScopedStaff): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(orders)
    .where(and(eq(orders.customerId, id), orderScope(staff)));

  return total;
}

export type CustomerFormData = { name: string; email: string; phone: string; city: string; status: string; address: string | null };

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));

/** CustomerForm's rules; the email must be free among customers not deleted. */
export async function validateCustomerForm(body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null): Promise<{ data: CustomerFormData; errors: null } | { data: null; errors: ValidationErrors }> {
  const t = (label: string) => lcfirst(translate(locale, label));
  const result = validate<Record<string, unknown>>(
    body,
    {
      name: ["required", "max:80"],
      email: ["required", "max:120", "email"],
      phone: ["required", "max:30", "regex:/^[0-9+\\-\\s()]+$/"],
      city: ["required", "max:60"],
      status: ["required", `in:${Object.values(CUSTOMER_STATUSES).join(",")}`],
      address: ["nullable"],
    },
    { "phone.regex": translate(locale, "Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( ).") },
    { name: t("Nama Lengkap"), email: t("Email"), phone: t("Nomor Telepon"), city: t("Kota"), status: t("Status"), address: t("Alamat") },
    locale,
  );
  let errors = result.errors;

  if (!errors?.email) {
    const [taken] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.email, text(body.email)), isNull(customers.deletedAt), ignoreId ? ne(customers.id, ignoreId) : undefined))
      .limit(1);

    if (taken) {
      errors = addError(errors, "email", translate(locale, "Email ini sudah dipakai pelanggan lain."));
    }
  }

  if (errors) {
    return { data: null, errors };
  }

  const address = text(body.address);

  return {
    data: { name: text(body.name), email: text(body.email), phone: text(body.phone), city: text(body.city), status: text(body.status), address: address.trim() === "" ? null : address },
    errors: null,
  };
}

/**
 * CreateCustomer: code CUS-001 onwards (counted among the customers this staff member
 * sees, deleted ones included), a random password the customer replaces by resetting
 * it, one of twelve avatars, and a default "Rumah" address in DKI Jakarta.
 */
export async function createCustomer(data: CustomerFormData, staff: ScopedStaff): Promise<Customer> {
  const [code, [{ existing }], password] = await Promise.all([
    nextCode({ table: customers, column: customers.code, prefix: "CUS-", where: customerBranchScope(staff) }),
    db
      .select({ existing: count() })
      .from(customers)
      .where(and(isNull(customers.deletedAt), customerBranchScope(staff))),
    hashLaravelPassword(randomString(40)),
  ]);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({
        name: data.name,
        email: data.email,
        phone: data.phone,
        status: data.status,
        code,
        password,
        avatarPath: `/media/images/users/avatar-${(existing % 12) + 1}.jpg`,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(customerAddresses).values({
      customerId: customer.id,
      isDefault: true,
      label: "Rumah",
      recipientName: customer.name,
      phone: customer.phone ?? "",
      addressLine: data.address || "—",
      kota: data.city,
      provinsi: "DKI Jakarta",
      createdAt: now,
      updatedAt: now,
    });

    return customer;
  });
}

/** EditCustomer: the customer's own columns, then the default address (updateOrCreate on is_default). */
export async function updateCustomer(customer: Customer, data: CustomerFormData): Promise<void> {
  const now = new Date();
  const next = { name: data.name, email: data.email, phone: data.phone, status: data.status };
  const changed = Object.entries(next).some(([key, value]) => customer[key as keyof Customer] !== value);

  await db.transaction(async (tx) => {
    if (changed) {
      await tx.update(customers).set({ ...next, updatedAt: now }).where(eq(customers.id, customer.id));
    }

    const address = { label: "Rumah", recipientName: data.name, phone: data.phone, addressLine: data.address || "—", kota: data.city, provinsi: "DKI Jakarta" };
    const [current] = await tx
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.customerId, customer.id), eq(customerAddresses.isDefault, true)))
      .orderBy(asc(customerAddresses.id))
      .limit(1);

    if (!current) {
      await tx.insert(customerAddresses).values({ customerId: customer.id, isDefault: true, ...address, createdAt: now, updatedAt: now });
    } else if (Object.entries(address).some(([key, value]) => current[key as keyof typeof current] !== value)) {
      await tx.update(customerAddresses).set({ ...address, updatedAt: now }).where(eq(customerAddresses.id, current.id));
    }
  });
}

export async function softDeleteCustomer(id: number): Promise<boolean> {
  await db
    .update(customers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(customers.id, id), isNull(customers.deletedAt)));

  return true;
}

export async function restoreCustomer(id: number): Promise<boolean> {
  await db.update(customers).set({ deletedAt: null, updatedAt: new Date() }).where(eq(customers.id, id));

  return true;
}

/** Fails (false) while orders still point at the customer: `orders.customer_id` restricts deletes. */
export async function forceDeleteCustomer(id: number): Promise<boolean> {
  try {
    await db.delete(customers).where(eq(customers.id, id));

    return true;
  } catch {
    return false;
  }
}

/** The selected ids that still exist for this staff member, for the bulk actions. */
export async function visibleCustomerIds(ids: number[], staff: ScopedStaff): Promise<number[]> {
  if (!ids.length) {
    return [];
  }

  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(inArray(customers.id, ids), customerBranchScope(staff)))
    .orderBy(asc(customers.id));

  return rows.map((row) => row.id);
}
