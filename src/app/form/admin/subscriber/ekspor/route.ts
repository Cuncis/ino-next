import { exportSubscribersAction } from "@/server/admin/subscriber-actions";

/** GET /form/admin/subscriber/ekspor: "Export CSV". */
export async function GET(request: Request) {
  return exportSubscribersAction(request);
}
