import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db, settings, type DbExecutor } from "@/db";

/**
 * A store setting, with a per-branch override when one exists.
 * Ported from App\Models\Setting::get(); `branch_id` null means it applies nationally.
 */
export async function getSetting(key: string, branchId: number | null = null, executor: DbExecutor = db): Promise<string | null> {
  const branchMatch = branchId === null ? isNull(settings.branchId) : or(eq(settings.branchId, branchId), isNull(settings.branchId));

  const [setting] = await executor
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.key, key), branchMatch))
    // a branch's own row wins over the national one
    .orderBy(sql`${settings.branchId} is null`)
    .limit(1);

  return setting?.value ?? null;
}

/**
 * Storage for the storefront content edited under Konten Website: each page's
 * content is one national `settings` row holding JSON. The page modules own their
 * defaults and shape; this only reads, writes and splits text.
 * Ported from App\Support\ContentStore.
 */

/** The saved content, or an empty object when nothing (valid) is saved. */
export async function readContent(key: string, executor: DbExecutor = db): Promise<Record<string, unknown>> {
  try {
    const saved: unknown = JSON.parse((await getSetting(key, null, executor)) ?? "{}");

    // PHP's json_decode(..., true) gives an array for both objects and lists
    return typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function writeContent(key: string, content: Record<string, unknown>, executor: DbExecutor = db): Promise<void> {
  const value = JSON.stringify(content);
  const now = new Date();

  const updated = await executor
    .update(settings)
    .set({ value, type: "json", updatedAt: now })
    .where(and(isNull(settings.branchId), eq(settings.key, key)))
    .returning({ id: settings.id });

  if (updated.length === 0) {
    await executor.insert(settings).values({ branchId: null, key, value, type: "json", createdAt: now, updatedAt: now });
  }
}

/** PHP's `\R`: any line break sequence. */
const LINE_BREAK = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/u;

/** Text split on blank lines, as the editors ask staff to write paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .trim()
    .split(LINE_BREAK)
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}

/** Text split into its non-empty lines, for lists written one item per line. */
export function lines(text: string): string[] {
  return text
    .trim()
    .split(LINE_BREAK)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
