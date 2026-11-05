import { chatSettingsAction } from "@/server/admin/inbox-actions";

/** POST /admin/inbox/pengaturan. */
export async function POST(request: Request) {
  return chatSettingsAction(request);
}
