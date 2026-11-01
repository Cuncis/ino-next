import { closeQueue } from "@/lib/queue";
import { SCHEDULED_TASKS, type ScheduledTaskName } from "@/server/scheduled/tasks";

/** `pnpm task pesanan:kadaluwarsakan`: one scheduled task now, like `php artisan pesanan:kadaluwarsakan`. */
const name = process.argv[2] as ScheduledTaskName | undefined;

if (!name || !(name in SCHEDULED_TASKS)) {
  console.error(`Pakai: pnpm task <${Object.keys(SCHEDULED_TASKS).join("|")}>`);
  process.exit(1);
}

async function main(task: ScheduledTaskName) {
  const { db } = await import("@/db");

  try {
    for (const line of await SCHEDULED_TASKS[task].run()) {
      console.info(line);
    }
  } finally {
    await closeQueue();
    await db.$client.end();
  }
}

void main(name);
