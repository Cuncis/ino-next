import { createCrmAction } from "@/server/admin/crm-actions";

/** POST /admin/pelanggan/buat. */
export async function POST(request: Request) {
  return createCrmAction(request, "pelanggan");
}
