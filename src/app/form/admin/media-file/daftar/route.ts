import { mediaPageAction } from "@/server/admin/media-actions";

/** GET /form/admin/media-file/daftar: one page of Media File. */
export async function GET(request: Request) {
  return mediaPageAction(request);
}
