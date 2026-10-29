import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, orders, type DbExecutor } from "@/db";
import { APP_TIMEZONE } from "./timezone";

const RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * A real customer order number: meaningful (branch + date, at a glance) and not
 * easy to guess (a random suffix), e.g. `INO-CB001-261029-K3F9Q`.
 * Ported from App\Support\OrderNumber::generate().
 *
 * Soft-deleted orders are checked too (Drizzle never hides them).
 */
export async function generateOrderNumber(branchCode: string, executor: DbExecutor = db): Promise<string> {
  for (;;) {
    const candidate = `INO-${branchCode}-${datePart(new Date())}-${randomSuffix(5)}`;
    const taken = await executor.select({ id: orders.id }).from(orders).where(eq(orders.number, candidate)).limit(1);

    if (taken.length === 0) {
      return candidate;
    }
  }
}

/** `ymd` in the app timezone, like PHP's now()->format('ymd'). */
function datePart(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}${part("month")}${part("day")}`;
}

/** Laravel's Str::upper(Str::random($length)): random letters and digits, upper-cased. */
function randomSuffix(length: number): string {
  let suffix = "";

  for (let i = 0; i < length; i++) {
    suffix += RANDOM_ALPHABET[randomInt(RANDOM_ALPHABET.length)];
  }

  return suffix.toUpperCase();
}
