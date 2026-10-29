import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "./relations";

// Reuse one pool across hot reloads in dev, otherwise every edit opens a new one
const globalForDb = globalThis as unknown as { db?: ReturnType<typeof createDb> };

function createDb() {
  return drizzle(process.env.DATABASE_URL!, { relations });
}

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;

export * from "./schema";
