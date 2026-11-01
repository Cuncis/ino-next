import type { JobName, JobPayloads } from "@/lib/queue";
import { sendChatReplyEmail } from "@/server/chat";
import { sendNewsletter } from "@/server/newsletter/newsletter-mail";
import { sendCustomerNotification } from "@/server/notifications/customer";
import { sendStaffNotification } from "@/server/notifications/staff";

/** Runs one queued job: the worker's side of `dispatch()`. */
export async function handleJob<N extends JobName>(name: N, data: JobPayloads[N]): Promise<void> {
  switch (name) {
    case "notify-customer":
      return sendCustomerNotification(data as JobPayloads["notify-customer"]);
    case "notify-staff":
      return sendStaffNotification(data as JobPayloads["notify-staff"]);
    case "chat-replied":
      return sendChatReplyEmail(data as JobPayloads["chat-replied"]);
    case "send-newsletter":
      return sendNewsletter(data as JobPayloads["send-newsletter"]);
    default:
      throw new Error(`Job tidak dikenal: ${String(name)}`);
  }
}
