import { and, asc, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { branches, branchStocks, db, orders } from "@/db";
import { translate, type AdminLocale } from "@/lib/admin-i18n";
import { BRANCH_STATUSES } from "@/lib/admin-options";
import { branchScope } from "@/lib/branch-scope";
import { nextCode } from "@/lib/code-sequence";
import type { ResourcePermissions } from "@/lib/permissions";
import { randomString } from "@/lib/random";
import { uniqueSlug } from "@/lib/slug";
import { uploadsDisk } from "@/lib/storage";
import { validate, type ValidationErrors } from "@/lib/validation";
import { orderBy, searchWords, trashedCondition, type SortState } from "./list-query";
import type { Staff } from "./staff-auth";

/**
 * Cabang (BranchResource): the list with stock counts and "Buka Sekarang", CreateBranch
 * (code CB-001 onwards, a slug, the default opening hours) and EditBranch. A branch with
 * stock on the shelf or orders in its history is closed via its status, never deleted.
 */
export const BRANCH_PERMISSIONS: ResourcePermissions = { viewAny: "Cabang:Lihat", create: "Cabang:Tambah", update: "Cabang:Ubah", delete: "Cabang:Hapus" };

export type Branch = typeof branches.$inferSelect;

type ScopedStaff = Pick<Staff, "branchId">;

export const BRANCH_SORTABLE = ["created_at"] as const;

/** CreateBranch::DEFAULT_HOURS: a new branch's week until someone edits it elsewhere. */
const DEFAULT_HOURS = {
  senin: { open: "08:00", close: "21:00" },
  selasa: { open: "08:00", close: "21:00" },
  rabu: { open: "08:00", close: "21:00" },
  kamis: { open: "08:00", close: "21:00" },
  jumat: { open: "08:00", close: "21:00" },
  sabtu: { open: "08:00", close: "21:00" },
  minggu: { open: "09:00", close: "20:00" },
};

const DAY_KEYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

/** `is_open_now`: an active branch whose posted hours for today (Jakarta) cover this minute. */
export function isOpenNow(branch: Pick<Branch, "status" | "operatingHours">, now = new Date()): boolean {
  if (branch.status !== "aktif") {
    return false;
  }

  const jakarta = new Date(now.getTime() + 7 * 3600_000);
  const hours = (branch.operatingHours as Record<string, { open?: string; close?: string }> | null)?.[DAY_KEYS[jakarta.getUTCDay()]];

  if (!hours?.open || !hours.close) {
    return false;
  }

  const clock = jakarta.toISOString().slice(11, 19);
  const time = (value: string) => (value.length === 5 ? `${value}:00` : value);

  return clock >= time(hours.open) && clock <= time(hours.close);
}

export async function listBranches(query: { search?: string; trashed?: string; sort: SortState; page: number; perPage: number }, staff: ScopedStaff) {
  const where = and(trashedCondition(branches.deletedAt, query.trashed), searchWords(query.search, [sql`${branches.code}`, sql`${branches.name}`, sql`${branches.kota}`]));
  const [{ total }] = await db.select({ total: count() }).from(branches).where(where);
  // withCount('stocks') goes through BranchStock's branch scope, so branch staff count only their own branch's rows
  const scope = branchScope(branchStocks.branchId, staff);
  const rows = await db
    .select({ branch: branches, stocks: sql<string>`(select count(*) from ${branchStocks} where ${branchStocks.branchId} = ${branches.id}${scope ? sql` and ${scope}` : sql``})` })
    .from(branches)
    .where(where)
    .orderBy(...orderBy(query.sort, { created_at: branches.createdAt }, { column: branches.name, direction: "asc" }, branches.id))
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows: rows.map((row) => ({ ...row.branch, stocksCount: Number(row.stocks) })) };
}

export async function findBranch(id: number): Promise<Branch | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);

  return row ?? null;
}

/**
 * The delete guard: stock on the shelf or any order. Both counts go through the branch
 * scope of BranchStock and Order, as Laravel's relations did.
 */
export async function branchInUse(id: number, staff: ScopedStaff): Promise<boolean> {
  const [[{ stock }], [{ placed }]] = await Promise.all([
    db
      .select({ stock: count() })
      .from(branchStocks)
      .where(and(eq(branchStocks.branchId, id), gt(branchStocks.quantity, 0), branchScope(branchStocks.branchId, staff))),
    db
      .select({ placed: count() })
      .from(orders)
      .where(and(eq(orders.branchId, id), isNull(orders.deletedAt), branchScope(orders.branchId, staff))),
  ]);

  return stock > 0 || placed > 0;
}

export type BranchFormData = {
  name: string;
  status: string;
  phone: string | null;
  whatsapp: string | null;
  address_line: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string;
  provinsi: string;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
  sia_number: string | null;
  apj_name: string | null;
  apj_sipa_number: string | null;
  practice_schedule: string | null;
  store_schedule: string | null;
  supports_delivery: boolean;
  supports_pickup: boolean;
  delivery_radius_km: string;
};

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const text = (value: unknown): string => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const optional = (value: unknown): string | null => (text(value) === "" ? null : text(value));
const TEL = "regex:/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\\s\\.\\/0-9]*$/";

/** BranchForm's rules, field by field in Filament's order. */
export function validateBranchForm(body: Record<string, unknown>, locale: AdminLocale): { data: BranchFormData; errors: null } | { data: null; errors: ValidationErrors } {
  const t = (label: string) => lcfirst(translate(locale, label));
  const delivery = text(body.supports_delivery) === "1";
  const result = validate<Record<string, unknown>>(
    { ...body, supports_delivery: delivery, supports_pickup: text(body.supports_pickup) === "1" },
    {
      name: ["required", "max:120"],
      status: ["required", `in:${Object.values(BRANCH_STATUSES).join(",")}`],
      phone: ["nullable", "max:30", TEL],
      whatsapp: ["nullable", "max:30", TEL],
      address_line: ["required", "max:255"],
      kelurahan: ["nullable", "max:80"],
      kecamatan: ["nullable", "max:80"],
      kota: ["required", "max:80"],
      provinsi: ["required", "max:80"],
      postal_code: ["nullable", "max:10"],
      latitude: [delivery ? "required" : "nullable", "numeric", "min:-90", "max:90"],
      longitude: [delivery ? "required" : "nullable", "numeric", "min:-180", "max:180"],
      sia_number: ["nullable", "max:60"],
      apj_name: ["nullable", "max:120"],
      apj_sipa_number: ["nullable", "max:60"],
      practice_schedule: ["nullable", "max:120"],
      store_schedule: ["nullable", "max:120"],
      delivery_radius_km: ["required", "numeric", "min:1", "max:100"],
    },
    {},
    {
      name: t("Nama Cabang"),
      status: t("Status"),
      phone: t("Telepon"),
      whatsapp: t("WhatsApp"),
      address_line: t("Alamat Jalan"),
      kelurahan: "kelurahan",
      kecamatan: "kecamatan",
      kota: t("Kota/Kabupaten"),
      provinsi: t("Provinsi"),
      postal_code: t("Kode Pos"),
      latitude: t("Lintang (Latitude)"),
      longitude: t("Bujur (Longitude)"),
      sia_number: t("Nomor SIA"),
      apj_name: t("Nama APJ"),
      apj_sipa_number: t("Nomor SIPA APJ"),
      practice_schedule: t("Waktu Praktik"),
      store_schedule: t("Jadwal Toko"),
      delivery_radius_km: t("Radius Antar (km)"),
    },
    locale,
  );

  if (result.errors) {
    return { data: null, errors: result.errors };
  }

  return {
    data: {
      name: text(body.name),
      status: text(body.status),
      phone: optional(body.phone),
      whatsapp: optional(body.whatsapp),
      address_line: text(body.address_line),
      kelurahan: optional(body.kelurahan),
      kecamatan: optional(body.kecamatan),
      kota: text(body.kota),
      provinsi: text(body.provinsi),
      postal_code: optional(body.postal_code),
      latitude: optional(body.latitude),
      longitude: optional(body.longitude),
      sia_number: optional(body.sia_number),
      apj_name: optional(body.apj_name),
      apj_sipa_number: optional(body.apj_sipa_number),
      practice_schedule: optional(body.practice_schedule),
      store_schedule: optional(body.store_schedule),
      supports_delivery: delivery,
      supports_pickup: text(body.supports_pickup) === "1",
      delivery_radius_km: text(body.delivery_radius_km),
    },
    errors: null,
  };
}

const IMAGE_EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif" };

/** The photo's checks: an image of an allowed type (SVG for Super Admin only), 4 MB at most. */
export function validateBranchPhoto(file: File | undefined, allowedTypes: string[], locale: AdminLocale): string | null {
  if (!file) {
    return null;
  }

  const attribute = lcfirst(translate(locale, "Foto Apotek"));

  if (!allowedTypes.includes(file.type)) {
    return translate(locale, "Kolom :attribute harus berupa berkas berjenis: :values.", { attribute, values: allowedTypes.join(", ") });
  }

  if (file.size > 4096 * 1024) {
    return translate(locale, "Kolom :attribute maksimal berukuran :max kilobita.", { attribute, max: 4096 });
  }

  return null;
}

/** The photo stored on the uploads disk under content/, named as Laravel's hashName() names it. */
async function storePhoto(file: File): Promise<string> {
  const path = `content/${randomString(40)}.${IMAGE_EXTENSIONS[file.type] ?? "bin"}`;

  await uploadsDisk().put(path, Buffer.from(await file.arrayBuffer()), file.type);

  return path;
}

/** Laravel's `Str::after($name, 'Apotek Inofarma ') ?: $name`. */
const slugSource = (name: string) => {
  const index = name.indexOf("Apotek Inofarma ");
  const after = index === -1 ? name : name.slice(index + "Apotek Inofarma ".length);

  return after || name;
};

/** `isset($lat, $lng)`: both filled, as the form sent them. */
const mapsUrl = (data: BranchFormData) => (data.latitude !== null && data.longitude !== null ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : null);

const columns = (data: BranchFormData) => ({
  name: data.name,
  status: data.status,
  phone: data.phone,
  whatsapp: data.whatsapp,
  addressLine: data.address_line,
  kelurahan: data.kelurahan,
  kecamatan: data.kecamatan,
  kota: data.kota,
  provinsi: data.provinsi,
  postalCode: data.postal_code,
  latitude: data.latitude,
  longitude: data.longitude,
  siaNumber: data.sia_number,
  apjName: data.apj_name,
  apjSipaNumber: data.apj_sipa_number,
  practiceSchedule: data.practice_schedule,
  storeSchedule: data.store_schedule,
  supportsDelivery: data.supports_delivery,
  supportsPickup: data.supports_pickup,
  // a decimal like 10.5 reaches PostgreSQL as typed, and is refused there as it was in Laravel
  deliveryRadiusKm: data.delivery_radius_km as unknown as number,
  mapsUrl: mapsUrl(data),
});

export async function createBranch(data: BranchFormData, photo: File | undefined): Promise<Branch> {
  const now = new Date();
  const [code, slug] = await Promise.all([nextCode({ table: branches, column: branches.code, prefix: "CB-" }), uniqueSlug({ table: branches, column: branches.slug, value: slugSource(data.name) })]);
  const [branch] = await db
    .insert(branches)
    .values({ ...columns(data), code, slug, operatingHours: DEFAULT_HOURS, photoPath: photo ? await storePhoto(photo) : null, createdAt: now, updatedAt: now })
    .returning();

  return branch;
}

/** The decimal columns as Eloquent's decimal:7 cast compares them. */
const decimal = (value: string | null) => (value === null ? null : Number(value).toFixed(7));

export async function updateBranch(branch: Branch, data: BranchFormData, photo: { file?: File; removed: boolean }): Promise<void> {
  const slug = await uniqueSlug({ table: branches, column: branches.slug, value: slugSource(data.name), idColumn: branches.id, ignoreId: branch.id });
  const photoPath = photo.file ? await storePhoto(photo.file) : photo.removed ? null : branch.photoPath;
  const next = { ...columns(data), slug, photoPath };
  const changed = Object.entries(next).some(([key, value]) => {
    const current = branch[key as keyof Branch];

    if (key === "latitude" || key === "longitude") {
      return decimal(current as string | null) !== decimal(value as string | null);
    }

    return String(current ?? "") !== String(value ?? "") || (current === null) !== (value === null);
  });

  if (changed) {
    await db
      .update(branches)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(branches.id, branch.id));
  }
}

export async function softDeleteBranch(id: number): Promise<boolean> {
  await db
    .update(branches)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(branches.id, id), isNull(branches.deletedAt)));

  return true;
}

export async function restoreBranch(id: number): Promise<boolean> {
  await db.update(branches).set({ deletedAt: null, updatedAt: new Date() }).where(eq(branches.id, id));

  return true;
}

/** Fails (false) while stock, orders or staff still point at the branch. */
export async function forceDeleteBranch(id: number): Promise<boolean> {
  try {
    await db.delete(branches).where(eq(branches.id, id));

    return true;
  } catch {
    return false;
  }
}

export async function existingBranchIds(ids: number[]): Promise<number[]> {
  if (!ids.length) {
    return [];
  }

  const rows = await db.select({ id: branches.id }).from(branches).where(inArray(branches.id, ids)).orderBy(asc(branches.id));

  return rows.map((row) => row.id);
}

/** The Staf form's branch picker: branches not deleted, by name. */
export async function branchOptions() {
  const rows = await db.select({ id: branches.id, name: branches.name }).from(branches).where(isNull(branches.deletedAt)).orderBy(asc(branches.name));

  return rows.map((row) => ({ value: String(row.id), label: row.name }));
}
