import { createAccessAction } from "@/server/admin/access-actions";

/** POST /admin/staf/buat. */
export async function POST(request: Request) {
  return createAccessAction(request, "staf");
}
