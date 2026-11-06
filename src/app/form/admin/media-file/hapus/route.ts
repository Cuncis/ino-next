import { deleteMediaAction } from "@/server/admin/media-actions";

/** POST /admin/media-file/hapus. */
export async function POST(request: Request) {
  return deleteMediaAction(request);
}
