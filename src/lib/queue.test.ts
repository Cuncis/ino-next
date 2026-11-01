import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";

const handled: unknown[] = [];

vi.mock("@/jobs/handlers", () => ({ handleJob: async (name: string, data: unknown) => void handled.push({ name, data }) }));

process.env.QUEUE_CONNECTION = "sync";

const { dispatch, transaction } = await import("./queue");
const job = { newsletterId: 1 };

beforeEach(() => {
  handled.length = 0;
});

afterAll(async () => {
  await db.$client.end();
});

describe("jobs dispatched in a transaction", () => {
  it("run once it commits, not before", async () => {
    await transaction(db, async () => {
      await dispatch("send-newsletter", job);
      expect(handled).toEqual([]);
    });

    expect(handled).toEqual([{ name: "send-newsletter", data: job }]);
  });

  it("never run when it rolls back, nor when a savepoint inside it does", async () => {
    await expect(
      transaction(db, async () => {
        await dispatch("send-newsletter", job);
        throw new Error("rolled back");
      }),
    ).rejects.toThrow("rolled back");

    await transaction(db, async (tx) => {
      await dispatch("send-newsletter", { newsletterId: 2 });
      await transaction(tx, async () => {
        await dispatch("send-newsletter", { newsletterId: 3 });
        throw new Error("savepoint");
      }).catch(() => undefined);
    });

    expect(handled).toEqual([{ name: "send-newsletter", data: { newsletterId: 2 } }]);
  });

  it("run at once outside a transaction", async () => {
    await dispatch("send-newsletter", job);
    expect(handled).toHaveLength(1);
  });
});
