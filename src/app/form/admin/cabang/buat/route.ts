import { createAccessAction } from "@/server/admin/access-actions";

/** POST /admin/cabang/buat. */
export async function POST(request: Request) {
  return createAccessAction(request, "cabang");
}
