import { AsyncLocalStorage } from "node:async_hooks";
import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { db, type DbExecutor } from "@/db";

/**
 * The job queue, standing in for Laravel's `database` queue: BullMQ on Redis, worked by
 * `pnpm worker` (src/jobs/worker.ts). QUEUE_CONNECTION=sync runs each job straight away
 * in the same process instead, as Laravel's `sync` driver does (tests use it).
 *
 * Laravel's database queue wrote its job rows in the same transaction as the change that
 * caused them, so a rolled-back change never sent a message. `transaction()` keeps that
 * promise here: a job dispatched inside it is held until the transaction commits, and
 * dropped if it rolls back (also for a savepoint that rolls back on its own).
 */
export const QUEUE_NAME = "default";

/** Every job the worker knows, with its payload. */
export type JobPayloads = {
  "notify-customer": { notification: CustomerNotificationName; orderId: number; customerId: number; channel: "mail" | "whatsapp" };
  "notify-staff": { notification: StaffNotificationName; userId: number; subjectId: number; extraId?: number };
  "chat-replied": { messageId: number; email: string; name: string };
  "send-newsletter": { newsletterId: number };
};

export type CustomerNotificationName = "OrderConfirmed" | "PaymentReceived" | "OrderShipped" | "OrderReadyForPickup" | "OrderCompleted" | "OrderCancelled";

export type StaffNotificationName = "NewOrderAtBranch" | "LowStock" | "ExpiringProduct" | "PickupDeadlineApproaching" | "NewChatMessage";

export type JobName = keyof JobPayloads;

type PendingJob = { name: JobName; data: unknown; options?: JobsOptions };

const pendingJobs = new AsyncLocalStorage<PendingJob[]>();

const globalForQueue = globalThis as unknown as { queue?: Queue; queueConnection?: IORedis };

/** One Redis connection for BullMQ (it needs `maxRetriesPerRequest: null`), reused across hot reloads. */
export function queueConnection(): IORedis {
  globalForQueue.queueConnection ??= new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", { maxRetriesPerRequest: null });

  return globalForQueue.queueConnection;
}

function queue(): Queue {
  globalForQueue.queue ??= new Queue(QUEUE_NAME, { connection: queueConnection() });

  return globalForQueue.queue;
}

/** Puts a job on the queue: now, or once the surrounding `transaction()` commits. */
export async function dispatch<N extends JobName>(name: N, data: JobPayloads[N], options?: JobsOptions): Promise<void> {
  const held = pendingJobs.getStore();

  if (held) {
    held.push({ name, data, options });

    return;
  }

  await send([{ name, data, options }]);
}

async function send(jobs: PendingJob[]): Promise<void> {
  if (jobs.length === 0) {
    return;
  }

  if (process.env.QUEUE_CONNECTION === "sync") {
    const { handleJob } = await import("@/jobs/handlers");

    for (const job of jobs) {
      // Laravel's sync driver ignores delays too; a failing job doesn't undo the request
      try {
        await handleJob(job.name, job.data as never);
      } catch (error) {
        console.error(error);
      }
    }

    return;
  }

  // removed once done, like Laravel deleting a finished job row; failures are kept
  await queue().addBulk(jobs.map((job) => ({ name: job.name, data: job.data, opts: { removeOnComplete: true, ...job.options } })));
}

/**
 * `db.transaction()` that holds dispatched jobs until it commits. Given an open
 * transaction it runs inside it (a savepoint), and the jobs wait for the outer commit.
 */
export async function transaction<T>(executor: DbExecutor, work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>): Promise<T> {
  const held = pendingJobs.getStore();

  if (executor !== db && held) {
    const before = held.length;

    try {
      return await executor.transaction(work);
    } catch (error) {
      // the savepoint rolled back: so do the jobs it dispatched
      held.length = before;
      throw error;
    }
  }

  const jobs: PendingJob[] = [];
  const result = await pendingJobs.run(jobs, () => executor.transaction(work));

  await send(jobs);

  return result;
}

/** Closes the queue's connection (scripts and tests). */
export async function closeQueue(): Promise<void> {
  await globalForQueue.queue?.close();
  globalForQueue.queueConnection?.disconnect();
  globalForQueue.queue = undefined;
  globalForQueue.queueConnection = undefined;
}
