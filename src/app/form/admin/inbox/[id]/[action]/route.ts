import { conversationAction } from "@/server/admin/inbox-actions";

/** POST /admin/inbox/{id}/{balas|tutup|buka|baca}. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/inbox/[id]/[action]">) {
  const { id, action } = await params;

  return conversationAction(request, id, action);
}
