import { db, type DbExecutor } from "@/db";

class Rollback extends Error {}

/** Runs `fn` in a transaction that is always rolled back, so tests never leave rows behind. */
export async function withRollback<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
  let result: T | undefined;

  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }

  return result as T;
}
