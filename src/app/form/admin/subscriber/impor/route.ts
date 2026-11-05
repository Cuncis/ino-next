import { importSubscribersAction } from "@/server/admin/subscriber-actions";

/** POST /admin/subscriber/impor. */
export async function POST(request: Request) {
  return importSubscribersAction(request);
}
