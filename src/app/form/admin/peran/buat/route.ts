import { createAccessAction } from "@/server/admin/access-actions";

/** POST /admin/peran/buat. */
export async function POST(request: Request) {
  return createAccessAction(request, "peran");
}
