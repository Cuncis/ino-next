import { unsubscribeAction } from "@/server/admin/subscriber-actions";

/** POST /admin/subscriber/{id}/berhentikan. */
export async function POST(request: Request, { params }: RouteContext<"/form/admin/subscriber/[id]/berhentikan">) {
  return unsubscribeAction(request, (await params).id);
}
