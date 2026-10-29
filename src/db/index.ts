import { drizzle } from "drizzle-orm/node-postgres";
import { APP_TIMEZONE } from "@/lib/timezone";
import { relations } from "./relations";

// Differences from Laravel's Eloquent to keep in mind when querying:
// - Soft-deleted rows are NOT hidden. Add `isNull(table.deletedAt)` wherever Laravel's
//   SoftDeletes would have hidden them (the code/slug generators want them included).
// - Branch scopes are not automatic. Admin queries add one from `@/lib/branch-scope`.
// - Timestamps are Jakarta wall-clock time, handled by the column type in schema.ts.

// Reuse one pool across hot reloads in dev, otherwise every edit opens a new one
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

function createDb() {
  return drizzle({
    connection: {
      connectionString: process.env.DATABASE_URL!,
      // Timestamps are Jakarta wall-clock time (see schema.ts), so SQL like now() and
      // CURRENT_TIMESTAMP must be too, whatever the server's own timezone is
      options: `-c TimeZone=${APP_TIMEZONE}`,
    },
    relations,
  });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

/** The client or an open transaction, so helpers can run inside a caller's `db.transaction()`. */
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export * from "./schema";
