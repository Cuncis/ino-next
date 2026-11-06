import { uploadMediaAction } from "@/server/admin/media-actions";

/** POST /admin/media-file/unggah. */
export async function POST(request: Request) {
  return uploadMediaAction(request);
}
