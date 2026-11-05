import { createCrmAction } from "@/server/admin/crm-actions";

/** POST /admin/kupon/buat. */
export async function POST(request: Request) {
  return createCrmAction(request, "kupon");
}
