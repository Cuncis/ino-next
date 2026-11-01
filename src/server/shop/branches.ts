import { and, asc, eq, inArray, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import { branches, branchStocks, db, products } from "@/db";
import { whatsappUrl } from "@/lib/phone";
import { APP_TIMEZONE } from "@/lib/timezone";
import { storefrontImage } from "./content/image-url";
import { company } from "./content/footer";

/**
 * Branches as a shopper sees them: distance, open/closed, and whether they can pick
 * one. Ported from App\Models\Branch (scopes and accessors) and
 * App\Support\Presenters\StorefrontBranchPresenter.
 *
 * Soft-deleted branches never reach the storefront (Laravel's SoftDeletes).
 */
type Branch = typeof branches.$inferSelect;
type Point = { lat: number; lng: number } | null;

const notDeleted = isNull(branches.deletedAt);
const active = eq(branches.status, "aktif");

/**
 * Haversine distance in km from a point to the row, computed in SQL so sorting and
 * limiting happen in the database. The cosine is clamped to [-1, 1]: at the branch's
 * own coordinates rounding can give 1.0000000000000002, which PostgreSQL rejects.
 */
function distanceSql(point: { lat: number; lng: number }): SQL<number> {
  return sql<number>`(6371 * acos(least(1, greatest(-1,
    cos(radians(${point.lat})) * cos(radians(${branches.latitude})) *
    cos(radians(${branches.longitude}) - radians(${point.lng})) +
    sin(radians(${point.lat})) * sin(radians(${branches.latitude}))
  ))))`;
}

/** Like Branch::scopeWithDistanceFrom(): every branch, with a null distance when it has no coordinates. */
function distanceColumn(point: Point): SQL<number | null> {
  if (!point) {
    return sql<null>`null`;
  }

  return sql<number | null>`case when ${branches.latitude} is null or ${branches.longitude} is null then null else ${distanceSql(point)} end`;
}

type BranchWithDistance = Branch & { distanceKm: number | null };

async function selectBranches(options: { where: (SQL | undefined)[]; point: Point; orderBy: SQL[]; limit?: number }): Promise<BranchWithDistance[]> {
  const query = db
    .select({ branch: branches, distanceKm: distanceColumn(options.point) })
    .from(branches)
    .where(and(notDeleted, ...options.where))
    .orderBy(...options.orderBy);
  const rows = options.limit ? await query.limit(options.limit) : await query;

  return rows.map((row) => ({ ...row.branch, distanceKm: row.distanceKm === null ? null : Number(row.distanceKm) }));
}

/**
 * Nearest first from a point when it is known; branches without coordinates come last.
 * With no point, by name. (Branch::scopeClosestTo)
 */
function closestTo(point: Point): SQL[] {
  if (!point) {
    return [asc(branches.name)];
  }

  return [sql`${branches.latitude} is null or ${branches.longitude} is null`, sql`${distanceColumn(point)} asc`, asc(branches.name)];
}

/** "Apotek Inofarma Terdekat" on the homepage: active branches with a photo. (Branch::scopeFeatured) */
export async function featuredBranchCards(point: Point, options: { excludeId?: number; limit?: number } = {}): Promise<BranchCard[]> {
  const rows = await selectBranches({
    where: [active, isNotNull(branches.photoPath), options.excludeId === undefined ? undefined : ne(branches.id, options.excludeId)],
    point,
    orderBy: closestTo(point),
    limit: options.limit,
  });

  return rows.map(card);
}

/** Every active branch for the branch locator API, nearest first when the point is known. */
export async function nearestBranches(point: Point) {
  const rows = point
    ? await selectBranches({
        where: [active, isNotNull(branches.latitude), isNotNull(branches.longitude)],
        point,
        orderBy: [sql`${distanceSql(point)} asc`],
      })
    : await selectBranches({ where: [active], point, orderBy: [asc(branches.kota), asc(branches.name)] });

  return rows.map((branch) => ({
    ...base(branch),
    addressLine: branch.addressLine,
    kecamatan: branch.kecamatan,
    fullAddress: fullAddress(branch),
    phone: branch.phone,
    whatsapp: branch.whatsapp,
    todaysHours: todaysHours(branch),
    siaNumber: branch.siaNumber,
    apjName: branch.apjName,
    apjSipaNumber: branch.apjSipaNumber,
  }));
}

/**
 * Every active branch carrying one product, for the product page's branch picker. A
 * branch with no stock is still listed, but not selectable; in stock and closer beats
 * out of stock and closer. Null when there is no such product.
 */
export async function branchesForProduct(sku: string, point: Point) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.sku, sku), isNull(products.deletedAt)))
    .limit(1);

  if (!product) {
    return null;
  }

  const rows = await selectBranches({ where: [active], point, orderBy: [asc(branches.kota), asc(branches.name)] });
  const stocks = rows.length
    ? await db
        .select({ branchId: branchStocks.branchId, quantity: branchStocks.quantity, reserved: branchStocks.reservedQuantity })
        .from(branchStocks)
        .where(and(eq(branchStocks.productId, product.id), inArray(branchStocks.branchId, rows.map((row) => row.id))))
    : [];

  const listed = rows.map((branch) => {
    const stock = stocks.find((row) => row.branchId === branch.id);
    const available = stock ? Math.max(stock.quantity - stock.reserved, 0) : 0;

    return { ...base(branch), fullAddress: fullAddress(branch), available, selectable: available > 0 && branch.status === "aktif" };
  });

  return listed.sort(
    (a, b) => Number(!a.selectable) - Number(!b.selectable) || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
  );
}

/**
 * Where a checkout order can be collected: every active pickup branch, stock or not (the
 * company covers a gap at pickup). Nearest first, then by name. (StorefrontBranchPresenter::forPickup)
 */
export async function pickupBranches(point: Point) {
  const rows = await selectBranches({ where: [active, eq(branches.supportsPickup, true)], point, orderBy: [asc(branches.id)] });

  return rows
    .map((branch) => ({ ...base(branch), fullAddress: fullAddress(branch), available: 1, selectable: branch.status === "aktif" }))
    .sort(
      (a, b) =>
        Number(!a.selectable) - Number(!b.selectable) ||
        (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
}

/** Whether `/apotek/{slug}` has a page to show; checked in src/proxy.ts so a missing one answers 404 before streaming. */
export async function branchPageExists(slug: string): Promise<boolean> {
  const [branch] = await db
    .select({ status: branches.status })
    .from(branches)
    .where(and(eq(branches.slug, slug), notDeleted))
    .limit(1);

  return branch !== undefined && branch.status !== "tutup permanen";
}

/** One apotek's own page, or null when there is none to show ("tutup permanen" is a 404). */
export async function branchPage(slug: string): Promise<{ branch: BranchPage; nearby: BranchCard[] } | null> {
  const [branch] = await db
    .select()
    .from(branches)
    .where(and(eq(branches.slug, slug), notDeleted))
    .limit(1);

  if (!branch || branch.status === "tutup permanen") {
    return null;
  }

  const latitude = branch.latitude !== null ? Number(branch.latitude) : null;
  const longitude = branch.longitude !== null ? Number(branch.longitude) : null;

  return {
    branch: {
      slug: branch.slug,
      name: branch.name,
      status: branch.status,
      photoUrl: branch.photoPath ? storefrontImage(branch.photoPath) : null,
      fullAddress: fullAddress(branch),
      siaNumber: branch.siaNumber,
      apjName: branch.apjName,
      apjSipaNumber: branch.apjSipaNumber,
      practiceSchedule: branch.practiceSchedule,
      storeSchedule: branch.storeSchedule,
      contactUrl: await contactUrl(branch),
      mapsUrl: branch.mapsUrl,
    },
    // "Apotek Terdekat Lainnya": the three featured branches nearest to this one
    nearby: await featuredBranchCards(latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null, {
      excludeId: branch.id,
      limit: 3,
    }),
  };
}

function card(branch: Branch): BranchCard {
  return {
    slug: branch.slug,
    name: branch.name,
    photoUrl: storefrontImage(branch.photoPath ?? ""),
    fullAddress: fullAddress(branch),
    apjName: branch.apjName,
  };
}

function base(branch: BranchWithDistance) {
  return {
    id: branch.code,
    name: branch.name,
    kota: branch.kota,
    distanceKm: branch.distanceKm !== null ? Math.round(branch.distanceKm * 10) / 10 : null,
    isOpenNow: isOpenNow(branch),
    status: branch.status,
    supportsDelivery: branch.supportsDelivery,
    supportsPickup: branch.supportsPickup,
    deliveryRadiusKm: branch.deliveryRadiusKm,
    mapsUrl: branch.mapsUrl,
  };
}

/** "Hubungi Kami": the branch's WhatsApp, else its phone, else the company's number on WhatsApp. */
async function contactUrl(branch: Branch): Promise<string | null> {
  if (branch.whatsapp) {
    return whatsappUrl(branch.whatsapp);
  }

  if (branch.phone) {
    return `tel:${branch.phone.replace(/[^\d+]/g, "")}`;
  }

  const companyPhone = (await company()).phone;

  return companyPhone !== "" ? whatsappUrl(companyPhone) : null;
}

/** Address parts that are filled in, joined: PHP's collect()->filter() drops null, "" and "0". */
export function fullAddress(branch: Pick<Branch, "addressLine" | "kelurahan" | "kecamatan" | "kota" | "provinsi" | "postalCode">): string {
  return [branch.addressLine, branch.kelurahan, branch.kecamatan, branch.kota, branch.provinsi, branch.postalCode]
    .filter((part) => part !== null && part !== "" && part !== "0")
    .join(", ");
}

/** Indonesian day keys of `operating_hours`, by JavaScript weekday (0 = Sunday). */
const DAY_KEYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

type Hours = Record<string, { open: string; close: string } | undefined>;

/** Today's weekday and the time as `HH:MM:SS`, in Jakarta. */
function jakartaNow(now = new Date()): { day: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday")),
    time: `${part("hour")}:${part("minute")}:${part("second")}`,
  };
}

/** "08:00" → "08:00:00", so times compare as strings. */
function clockTime(value: string): string {
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");

  return [hours, minutes, seconds].map((piece) => piece.padStart(2, "0")).join(":");
}

/** Whether the branch's posted hours cover the moment (status is checked separately). */
export function isOpenAt(branch: Pick<Branch, "operatingHours">, now = new Date()): boolean {
  const { day, time } = jakartaNow(now);
  const hours = (branch.operatingHours as Hours | null)?.[DAY_KEYS[day]];

  if (!hours) {
    return false;
  }

  return time >= clockTime(hours.open) && time <= clockTime(hours.close);
}

export function isOpenNow(branch: Pick<Branch, "operatingHours" | "status">, now = new Date()): boolean {
  return branch.status === "aktif" && isOpenAt(branch, now);
}

/** "08:00 - 21:00" for today, or null when the branch posts no hours today. */
export function todaysHours(branch: Pick<Branch, "operatingHours">, now = new Date()): string | null {
  const hours = (branch.operatingHours as Hours | null)?.[DAY_KEYS[jakartaNow(now).day]];

  return hours ? `${hours.open} - ${hours.close}` : null;
}
