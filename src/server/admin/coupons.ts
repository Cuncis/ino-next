import { and, asc, count, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { branches, couponBranch, coupons, db } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { COUPON_STATUSES, COUPON_TYPES } from "@/lib/admin-options";
import { SUPER_ADMIN_ROLE, type ResourcePermissions } from "@/lib/permissions";
import { addError, validate, type ValidationErrors } from "@/lib/validation";
import { searchWords, trashedCondition } from "./list-query";

/**
 * Kupon (CouponResource): a coupon sets prices, so only Super Admin manages coupons.
 * No branches ticked means the coupon is valid at every branch.
 */
export const COUPON_PERMISSIONS: ResourcePermissions = { viewAny: SUPER_ADMIN_ROLE, create: SUPER_ADMIN_ROLE, update: SUPER_ADMIN_ROLE, delete: SUPER_ADMIN_ROLE };

export type Coupon = typeof coupons.$inferSelect;

export async function listCoupons(query: { search?: string; trashed?: string; page: number; perPage: number }) {
  const where = and(trashedCondition(coupons.deletedAt, query.trashed), searchWords(query.search, [sql`${coupons.code}`]));
  const [{ total }] = await db.select({ total: count() }).from(coupons).where(where);
  const rows = await db
    .select()
    .from(coupons)
    .where(where)
    .orderBy(asc(coupons.code), asc(coupons.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);
  const names = await couponBranchNames(rows.map((row) => row.id));

  return { total, rows: rows.map((row) => ({ ...row, branchNames: names.get(row.id) ?? [] })) };
}

/** Each coupon's branches, as the pivot lists them. */
async function couponBranchNames(ids: number[]) {
  const found = new Map<number, string[]>();

  if (!ids.length) {
    return found;
  }

  const rows = await db
    .select({ couponId: couponBranch.couponId, name: branches.name })
    .from(couponBranch)
    .innerJoin(branches, and(eq(branches.id, couponBranch.branchId), isNull(branches.deletedAt)))
    .where(inArray(couponBranch.couponId, ids))
    // the eager load's join comes back in the branches' order
    .orderBy(asc(branches.id));

  for (const row of rows) {
    found.set(row.couponId, [...(found.get(row.couponId) ?? []), row.name]);
  }

  return found;
}

/** `is_exhausted`: the quota is used up. */
export const isExhausted = (coupon: Coupon) => coupon.quota !== null && coupon.usedCount >= coupon.quota;

/** `is_expired`: the end date (its midnight) has passed, so a coupon is already expired on its last day. */
export const isExpired = (coupon: Coupon) => coupon.expiresAt !== null && coupon.expiresAt.getTime() < Date.now();

export async function findCoupon(id: number): Promise<Coupon | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);

  return row ?? null;
}

export async function couponBranchIds(id: number): Promise<string[]> {
  const rows = await db.select({ branchId: couponBranch.branchId }).from(couponBranch).where(eq(couponBranch.couponId, id)).orderBy(asc(couponBranch.id));

  return rows.map((row) => String(row.branchId));
}

/** The CheckboxList's options: every branch (not deleted), by name. */
export async function couponBranchOptions() {
  const rows = await db.select({ id: branches.id, name: branches.name }).from(branches).where(isNull(branches.deletedAt)).orderBy(asc(branches.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}

export type CouponFormData = {
  code: string;
  type: string;
  value: string | null;
  minimum_purchase: string | null;
  quota: string | null;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  branches: number[];
};

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const optional = (value: unknown): string | null => (text(value).trim() === "" ? null : text(value));

/**
 * CouponForm's rules. The code is upper-cased (on blur in the form, and again when
 * saved); the value is only asked for when the type isn't free shipping.
 */
export async function validateCouponForm(body: Record<string, unknown>, locale: AdminLocale, ignoreId: number | null): Promise<{ data: CouponFormData; errors: null } | { data: null; errors: ValidationErrors }> {
  const t = (label: string) => lcfirst(translate(locale, label));
  const freeShipping = text(body.type) === "ongkir gratis";
  const branchIds = Array.isArray(body.branches) ? body.branches.map(text) : [];
  const result = validate<Record<string, unknown>>(
    { ...body, branches: branchIds },
    {
      code: ["required", "max:40", "regex:/^[A-Z0-9]+$/"],
      type: ["required", `in:${Object.values(COUPON_TYPES).join(",")}`],
      ...(freeShipping ? {} : { value: ["required", "numeric", "min:0", "max:1000000000"] }),
      minimum_purchase: ["nullable", "numeric", "min:0", "max:1000000000"],
      quota: ["nullable", "numeric", "min:1"],
      status: ["required", `in:${Object.values(COUPON_STATUSES).join(",")}`],
      starts_at: ["nullable", "date"],
      expires_at: ["nullable", "date", "after_or_equal:starts_at"],
    },
    {
      "code.regex": translate(locale, "Kode kupon hanya boleh berisi huruf kapital dan angka."),
      "value.required": translate(locale, "Nilai kupon wajib diisi untuk tipe ini."),
      "expires_at.after_or_equal": translate(locale, "Tanggal berlaku sampai tidak boleh sebelum tanggal mulai."),
    },
    {
      code: t("Kode Kupon"),
      type: t("Tipe Diskon"),
      value: lcfirst(translate(locale, text(body.type) === "persentase" ? "Nilai Diskon (%)" : "Nilai Diskon (Rp)")),
      minimum_purchase: t("Minimum Belanja (Rp)"),
      quota: t("Kuota Penggunaan"),
      status: t("Status"),
      starts_at: t("Mulai Berlaku"),
      expires_at: t("Berlaku Sampai"),
    },
    locale,
  );
  let errors = result.errors;
  const code = text(body.code).toUpperCase();

  if (!errors?.code) {
    const [taken] = await db
      .select({ id: coupons.id })
      .from(coupons)
      .where(and(eq(coupons.code, text(body.code)), isNull(coupons.deletedAt), ignoreId ? ne(coupons.id, ignoreId) : undefined))
      .limit(1);

    if (taken) {
      errors = addError(errors, "code", translate(locale, "Kode kupon ini sudah dipakai."));
    }
  }

  if (errors) {
    return { data: null, errors };
  }

  const options = new Set((await couponBranchOptions()).map((option) => option.value));

  return {
    data: {
      code,
      type: text(body.type),
      // Gratis Ongkir carries no product discount of its own (CreateCoupon / EditCoupon)
      value: freeShipping ? "0" : optional(body.value),
      minimum_purchase: optional(body.minimum_purchase),
      quota: optional(body.quota),
      status: text(body.status),
      starts_at: optional(body.starts_at),
      expires_at: optional(body.expires_at),
      branches: [...new Set(branchIds.filter((id) => options.has(id)))].map(Number),
    },
    errors: null,
  };
}

const columns = (data: CouponFormData) => ({
  code: data.code,
  type: data.type,
  // strings, as Laravel passed them: a fraction makes PostgreSQL refuse the row, as it did there
  value: data.value as unknown as number,
  minimumPurchase: data.minimum_purchase as unknown as number | null,
  quota: data.quota as unknown as number | null,
  status: data.status,
  startsAt: data.starts_at ? new Date(`${data.starts_at.slice(0, 10)}T00:00:00+07:00`) : null,
  expiresAt: data.expires_at ? new Date(`${data.expires_at.slice(0, 10)}T00:00:00+07:00`) : null,
});

export async function createCoupon(data: CouponFormData): Promise<Coupon> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const [coupon] = await tx
      .insert(coupons)
      .values({ ...columns(data), createdAt: now, updatedAt: now })
      .returning();

    if (data.branches.length) {
      await tx.insert(couponBranch).values(data.branches.map((branchId) => ({ couponId: coupon.id, branchId })));
    }

    return coupon;
  });
}

/** EditCoupon: the coupon's columns when changed, then `sync()` of the branches. */
export async function updateCoupon(coupon: Coupon, data: CouponFormData): Promise<void> {
  const next = columns(data);
  const same = (a: unknown, b: unknown) => (a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime() === (b as Date | null)?.getTime() : String(a ?? "") === String(b ?? ""));
  const changed = Object.entries(next).some(([key, value]) => !same(coupon[key as keyof Coupon], value));

  await db.transaction(async (tx) => {
    if (changed) {
      await tx.update(coupons).set({ ...next, updatedAt: new Date() }).where(eq(coupons.id, coupon.id));
    }

    const current = (await tx.select({ branchId: couponBranch.branchId }).from(couponBranch).where(eq(couponBranch.couponId, coupon.id))).map((row) => row.branchId);
    const detach = current.filter((id) => !data.branches.includes(id));
    const attach = data.branches.filter((id) => !current.includes(id));

    if (detach.length) {
      await tx.delete(couponBranch).where(and(eq(couponBranch.couponId, coupon.id), inArray(couponBranch.branchId, detach)));
    }

    if (attach.length) {
      await tx.insert(couponBranch).values(attach.map((branchId) => ({ couponId: coupon.id, branchId })));
    }
  });
}

export async function softDeleteCoupon(id: number): Promise<boolean> {
  await db
    .update(coupons)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(coupons.id, id), isNull(coupons.deletedAt)));

  return true;
}

export async function restoreCoupon(id: number): Promise<boolean> {
  await db.update(coupons).set({ deletedAt: null, updatedAt: new Date() }).where(eq(coupons.id, id));

  return true;
}

export async function forceDeleteCoupon(id: number): Promise<boolean> {
  try {
    await db.delete(coupons).where(eq(coupons.id, id));

    return true;
  } catch {
    return false;
  }
}

export async function existingCouponIds(ids: number[]): Promise<number[]> {
  if (!ids.length) {
    return [];
  }

  const rows = await db.select({ id: coupons.id }).from(coupons).where(inArray(coupons.id, ids)).orderBy(asc(coupons.id));

  return rows.map((row) => row.id);
}
