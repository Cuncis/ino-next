import { saveMatrixAction } from "@/server/admin/access-actions";

/** POST /admin/hak-akses/simpan. */
export async function POST(request: Request) {
  return saveMatrixAction(request);
}
