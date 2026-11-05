import { and, asc, count, eq, sql } from "drizzle-orm";
import { db, subscribers } from "@/db";
import { isPhpValidEmail } from "@/lib/php-email";
import { randomString } from "@/lib/random";
import { csvLine, parseRecords } from "@/server/catalog/csv";
import { SUBSCRIBED, UNSUBSCRIBED, type Subscriber } from "@/server/newsletter/subscribers";
import { orderBy, searchWords, type SortState } from "./list-query";

/**
 * Subscriber (SubscriberResource, under Newsletter): the list with its status filter,
 * Import CSV and Export CSV (App\Support\Newsletters\SubscriberCsv), and "Berhentikan".
 * Subscribers come from the storefront or an import; none is created here.
 */
export const SUBSCRIBER_SORTABLE = ["email", "subscribed_at", "unsubscribed_at"] as const;

type Filters = { search?: string; status?: string };

function filtered(query: Filters) {
  return and(query.status ? eq(subscribers.status, query.status) : undefined, searchWords(query.search, [sql`${subscribers.email}`]));
}

export async function listSubscribers(query: Filters & { sort: SortState; page: number; perPage: number }) {
  const where = filtered(query);
  const [{ total }] = await db.select({ total: count() }).from(subscribers).where(where);
  const rows = await db
    .select()
    .from(subscribers)
    .where(where)
    .orderBy(
      ...orderBy(query.sort, { email: subscribers.email, subscribed_at: subscribers.subscribedAt, unsubscribed_at: subscribers.unsubscribedAt }, { column: subscribers.id, direction: "desc" }, subscribers.id),
    )
    .limit(query.perPage)
    .offset((query.page - 1) * query.perPage);

  return { total, rows };
}

export async function findSubscriber(id: number): Promise<Subscriber | null> {
  if (!Number.isSafeInteger(id)) {
    return null;
  }

  const [row] = await db.select().from(subscribers).where(eq(subscribers.id, id)).limit(1);

  return row ?? null;
}

/** `toDateTimeString()` in Jakarta. */
const dateTime = (date: Date | null) => (date ? new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 19).replace("T", " ") : null);

/** SubscriberCsv::export(): the filtered subscribers by id (no byte-order mark). */
export async function exportSubscribers(query: Filters): Promise<string> {
  const rows = await db.select().from(subscribers).where(filtered(query)).orderBy(asc(subscribers.id));

  return csvLine(["email", "status", "subscribed_at", "unsubscribed_at"]) + rows.map((row) => csvLine([row.email, row.status, dateTime(row.subscribedAt), dateTime(row.unsubscribedAt)])).join("");
}

const stripBom = (value: string) => value.replace(/^\uFEFF/, "");
/** PHP's trim() */
const trim = (value: string) => value.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, "");

/**
 * SubscriberCsv::import(): one address per line, or a file with an "email" column (and
 * optionally "status"). An address already on the list is left exactly as it is, so an
 * import never subscribes someone who unsubscribed; a row marked berhenti/unsubscribed
 * is added as unsubscribed.
 */
export async function importSubscribers(content: string): Promise<{ imported: number; duplicates: number; invalid: number }> {
  const result = { imported: 0, duplicates: 0, invalid: 0 };
  const firstLine = /^[^\n]*\n?/.exec(content)?.[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  let emailColumn = 0;
  let statusColumn: number | null = null;
  let first = true;

  for (const row of parseRecords(content, delimiter)) {
    if (row === null || row.length === 0) {
      continue;
    }

    if (first) {
      first = false;

      const header = row.map((cell) => trim(stripBom(cell)).toLowerCase());

      if (header.includes("email")) {
        emailColumn = header.indexOf("email");
        statusColumn = header.includes("status") ? header.indexOf("status") : null;
        continue;
      }
    }

    const email = trim(stripBom(row[emailColumn] ?? "")).toLowerCase();

    if (!isPhpValidEmail(email) || Buffer.byteLength(email) > 255) {
      result.invalid++;
      continue;
    }

    const [existing] = await db.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.email, email)).limit(1);

    if (existing) {
      result.duplicates++;
      continue;
    }

    const optedOut = statusColumn !== null && ["berhenti", "unsubscribed"].includes(trim(row[statusColumn] ?? "").toLowerCase());
    const now = new Date();

    await db.insert(subscribers).values({
      email,
      status: optedOut ? UNSUBSCRIBED : SUBSCRIBED,
      unsubscribeToken: randomString(64),
      subscribedAt: optedOut ? null : now,
      unsubscribedAt: optedOut ? now : null,
      createdAt: now,
      updatedAt: now,
    });
    result.imported++;
  }

  return result;
}

export async function subscribedCount(): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(subscribers).where(eq(subscribers.status, SUBSCRIBED));

  return total;
}
