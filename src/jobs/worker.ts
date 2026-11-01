import { Worker } from "bullmq";
import cron from "node-cron";
import { closeQueue, QUEUE_NAME, queueConnection, type JobName } from "@/lib/queue";
import { APP_TIMEZONE } from "@/lib/timezone";
import { SCHEDULED_TASKS, type ScheduledTaskName } from "@/server/scheduled/tasks";
import { handleJob } from "./handlers";

/**
 * The background process (`pnpm worker`), standing in for Laravel's `queue:work` and
 * `schedule:work` together: it works the job queue (notifications, chat reply emails,
 * newsletters) and runs the scheduled tasks of routes/console.php in Jakarta time.
 * Run exactly one scheduler: start more workers with WORKER_SCHEDULE=false.
 */

// a newsletter to every subscriber may take a while (Laravel's job allowed an hour)
const worker = new Worker(QUEUE_NAME, async (job) => handleJob(job.name as JobName, job.data), {
  connection: queueConnection(),
  concurrency: 5,
  lockDuration: 60_000,
});

worker.on("failed", (job, error) => console.error(`Job gagal: ${job?.name} #${job?.id}`, error));

const running = new Set<ScheduledTaskName>();

async function runTask(name: ScheduledTaskName): Promise<void> {
  // a run still going when the next is due is left to finish (no overlapping runs)
  if (running.has(name)) {
    return;
  }

  running.add(name);

  try {
    for (const line of await SCHEDULED_TASKS[name].run()) {
      console.info(`[${name}] ${line}`);
    }
  } catch (error) {
    console.error(`[${name}] gagal`, error);
  } finally {
    running.delete(name);
  }
}

if (process.env.WORKER_SCHEDULE !== "false") {
  for (const [name, task] of Object.entries(SCHEDULED_TASKS) as [ScheduledTaskName, (typeof SCHEDULED_TASKS)[ScheduledTaskName]][]) {
    cron.schedule(task.cron, () => runTask(name), { timezone: APP_TIMEZONE, name });
  }
}

async function shutdown() {
  await worker.close();
  await closeQueue();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.info(`Worker started${process.env.WORKER_SCHEDULE === "false" ? " (no scheduler)" : ", scheduler on"}`);
